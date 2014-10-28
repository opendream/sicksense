var fs = require('fs');

function loadFile(filePath) {
  return fs.readFileSync(filePath, { encoding: 'UTF8' });
}

module.exports.mail = {

  verification: {
    subject: 'Please verify your e-mail',
    from: 'John Doe <john@example.com>',
    html: loadFile('./assets/templates/email/verification.html'),
    body: loadFile('./assets/templates/email/verification.txt')
  },

  notification: {
    subjects: [
    	'Hi there',
    	'How are you?'
    ],
    from: 'John Doe <john@example.com>',
    html: loadFile('./assets/templates/email/notification.html'),
    body: loadFile('./assets/templates/email/notification.txt')
  },

  forgotPassword: {
    subject: 'Forgot password',
    from: 'John Doe <john@example.com>',
    html: loadFile('./assets/templates/email/forgot_password.html'),
    body: loadFile('./assets/templates/email/forgot_password.txt')
  }

};
