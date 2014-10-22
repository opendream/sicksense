var fs = require('fs');

function loadFile(filePath) {
  return fs.readFileSync(filePath, { encoding: 'UTF8' });
}

module.exports.mail = {

  verificationEmail: {
    subject: 'Please verify your e-mail',
    body: 'Use this link %token%',
    from: 'John Doe <john@example.com>',
    html: 'Use this link %token%',
    lifetime: (60 * 60) * 3000 // 3 hours
  },

  notification: {
    subjects: [
    	'Hi there',
    	'How are you?'
    ],
    from: 'John Doe <john@example.com>',
    html: loadFile('./assets/templates/email/notification.html'),
    text: loadFile('./assets/templates/email/notification.txt')
  },

  forgotPassword: {
    subject: 'Forgot password',
    from: 'John Doe <john@example.com>',
    html: loadFile('./assets/templates/email/forgot_password.html'),
    text: loadFile('./assets/templates/email/forgot_password.txt')
  }

};
