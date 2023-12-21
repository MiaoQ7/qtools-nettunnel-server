

const { exec, spawn } = require('child_process');

module.exports = {
  processToCheck (name) {
    return new Promise((resolve, reject) => {
      exec(`ps aux | grep '[${name[0]}]${name.slice(1)}'`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error checking for ${name}: ${error.message}`);
          resolve(false)
          return;
        }

        if (stdout.includes(name)) {
          console.log(`${name} is running.`);
          resolve(true)
        } else {
          console.log(`${name} is not running.`);
          resolve(false)
        }
      });
    })
  },
  processToKill (name) {
    return new Promise((resolve, reject) => {
      exec(`pkill ${name}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error killing ${name}: ${error.message}`);
          reject(error.message)
          return;
        }

        if (stderr) {
          console.error(`Error output from killing ${name}: ${stderr}`);
          resolve(false)
        } else {
          console.log(`${name} process has been terminated.`);
          resolve(true)
        }
      });
    })
  },
  startProcess(name, args, cwd) {
    const frpsProcess = spawn(name, args, {
      detached: true,
      stdio: 'ignore',
      cwd: cwd,
    });
    frpsProcess.unref();

    console.log('frps process is running in the background.');
  },
  checkNginx(nginxPath) {
    return new Promise((resolve, reject) => {
      exec(nginxPath + ' -t', (error, stdout, stderr) => {
        if (error) {
          console.error('Error running nginx -t:', error.message);
          console.error('stderr:', stderr);
          resolve(false)
        } else {
          // 检查命令是否正常退出
          if (stderr.includes('successful')) {
            console.log('nginx -t is successful. Nginx configuration is valid.');
            resolve(true)
          } else {
            console.error('nginx -t returned an error. Nginx configuration is invalid.');
            console.error('stderr:', stderr);
            resolve(false)
          }
        }
      });
    })
  },
  reloadNginx(nginxPath) {
    return new Promise((resolve, reject) => {
      exec(nginxPath + ' -s reload', (error, stdout, stderr) => {
        if (error) {
          console.error('Error running nginx -s reload:', error.message);
          console.error('stderr:', stderr);
          // 在这里可以进行错误处理逻辑
          resolve(false)
        } else {
          console.log('Nginx reloaded successfully.');
          console.log('stdout:', stdout);
          // 在这里可以进行成功处理逻辑
          resolve(true)
        }
      });
    })
  },
  createSSL(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          // 在这里可以进行错误处理逻辑
          resolve(false)
        } else {
          // 在这里可以进行成功处理逻辑
          resolve(true)
        }
      });
    })
  },
  deleteDirectory (directory) {
    return new Promise((resolve, reject) => {
      exec(`rm -fr ${directory}`, (error, stdout, stderr) => {
        if (error) {
          // 在这里可以进行错误处理逻辑
          resolve(false)
        } else {
          // 在这里可以进行成功处理逻辑
          resolve(true)
        }
      });
    })
  }
 }
