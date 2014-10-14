module.exports.mail = {
  verificationEmail: {
    subject: '[sicksense] Please verify your e-mail',
    body: 'Use this link %token%',
    from: 'sicksense.org',
    html: 'Use this link %token%',
    lifetime: (60 * 60) * 3000 // 3 hours
  }
};
