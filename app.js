





const http = require('http');
const url = require('url');
const querystring = require('querystring');
const fs = require('fs');
const path = require('path');
const net = require('net');
const {processToCheck,processToKill,startProcess,checkNginx,reloadNginx,createSSL} = require('./checkProcess')

//===========nginx config=========================
const nginx_conf_path = '/www/server/panel/vhost/nginx'
const nginx_root_path = '/www/wwwroot'
const bt_panel_path = '/www/server/panel'
const nginx_bin_path = '/www/server/nginx/sbin/nginx'
//================nginx config end=================

//===================frps config==========================
const frps_path = '/opt/frps'
//===================frps config end==========================

async function startFrps() {
  if (await processToCheck('frps')) {
    await processToKill('frps')
  }

  startProcess(frps_path + '/frps', ['-c', 'frps.toml'], frps_path)
}

startFrps()

deleteFilesInDirectory(nginx_conf_path).then(() => {
  deleteFilesInDirectory(nginx_root_path).then(() => {
    restartNginx()
  })
})

async function restartNginx() {
  if (await checkNginx(nginx_bin_path)) {
    await reloadNginx(nginx_bin_path)
  }
}

function deleteDirectory(directoryPath) {
  // 递归删除目录及其内容
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach(file => {
      const filePath = path.join(directoryPath, file);

      if (fs.lstatSync(filePath).isDirectory()) {
        // 如果是子目录，则递归删除子目录
        deleteDirectory(filePath);
      } else {
        // 如果是文件，则删除文件
        fs.unlinkSync(filePath);
      }
    });

    // 删除空目录
    fs.rmdirSync(directoryPath);
    console.log('Directory deleted:', directoryPath);
  } else {
    console.error('Directory does not exist:', directoryPath);
  }
}

function deleteFilesInDirectory(directoryPath) {
  // 读取目录中的所有文件
  return new Promise(r => {
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        console.error('Error reading directory:', err);
        r()
        return;
      }
      let p = []
      files.forEach(file => {
        const filePath = path.join(directoryPath, file);
        if (filePath.indexOf('.qq.miaomiao.press') >= 0) {
          if (fs.lstatSync(filePath).isDirectory()) {
            deleteDirectory(filePath)
          } else {
            p.push(new Promise(rr => {
              fs.unlink(filePath, err => {
                if (err) {
                  console.error('Error deleting file:', err);
                } else {
                  console.log('Deleted file:', filePath);
                }
                rr()
              })
            }))
          }
        }
      });

      Promise.all(p).then(r)
    });
  })
}

// 每24小时执行一次
setInterval(async () => {
  console.log('run delete all')
  // 删除所有配置
  await deleteFilesInDirectory(nginx_conf_path)
  await deleteFilesInDirectory(nginx_root_path)
  // 重启nginx
  await restartNginx()
  // 重启frps
  await startFrps()
}, 1000 * 3600)

function generateRandomString(length) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let randomString = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    randomString += alphabet.charAt(randomIndex);
  }

  return randomString;
}

const randomInt = (min, max) => Math.floor(Math.random() * (max - min) + min);

function isPortTaken(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.once('close', () => {
          resolve(false);
        }).close();
      })
      .listen(port);
  });
}

async function findDomainAndPort() {
  let count = 100
  while (count > 0) {
    count--
    let domain = generateRandomString(6)
    if (fs.existsSync(path.join(nginx_conf_path, domain + '.qq.miaomiao.press.conf'))) {
      continue
    }
    let port = randomInt(50000, 60000)
    const isPortInUse = await isPortTaken(port);
    if (isPortInUse) {
      continue
    }
    return {
      domain: domain + '.qq.miaomiao.press',
      port: port //  50000-60000
    }
  }
  return {domain: '', port: 0}
}

async function createNginx({domain, port}) {
  let buf = fs.readFileSync(path.join(__dirname, 'template.conf'), { encoding: 'utf-8' })
  buf = buf.replace(/\$\{server_name\}/g, domain)
  let confPath = path.join(nginx_conf_path, domain + '.conf')
  if (fs.existsSync(confPath)) {
    throw Error('domain has exist')
  }
  fs.writeFileSync(confPath, buf, { encoding: 'utf-8' })
  fs.mkdirSync(path.join(nginx_root_path, domain))
  await restartNginx()
  await createSSL(`${bt_panel_path}/pyenv/bin/python ${bt_panel_path}/class/acme_v2.py --domain ${domain} --type http --path ${nginx_root_path}/${domain}`)

  buf = fs.readFileSync(path.join(__dirname, 'template_proxy.conf'), { encoding: 'utf-8' })
  buf = buf.replace(/\$\{server_name\}/g, domain).replace('${proxy_address}', `http://127.0.0.1:${port}`)
  confPath = path.join(nginx_conf_path, domain + '.conf')
  if (fs.existsSync(confPath)) {
    fs.unlinkSync(confPath)
  }
  fs.writeFileSync(confPath, buf, { encoding: 'utf-8' })
  await restartNginx()
}

const server = http.createServer(async (req, res) => {
  try {
    // 解析请求的 URL
    const parsedUrl = url.parse(req.url);
    console.log(parsedUrl)
    // 解析查询参数
    let text = 'success'
    const queryParams = querystring.parse(parsedUrl.query);
    if (parsedUrl.path == '/add') {
      let conf = await findDomainAndPort()
      if (!conf.domain) {
        throw Error('domain not find')
      }
      await createNginx(conf)
      text = JSON.stringify(conf)
    }

    // 设置响应头
    res.writeHead(200, {'Content-Type': 'text/plain'});

    // 发送响应数据
    res.end(text);
  } catch (e) {
    console.log(e)
    // 设置响应头
    res.writeHead(500, {'Content-Type': 'text/plain'});

    // 发送响应数据
    res.end(`response error`);
  }
});

const port = 3000;
const host = '127.0.0.1';

server.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}/`);
});

