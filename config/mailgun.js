module.exports.mailgun = {

    apiKey: 'key-XXXXXXXXXXXXXXXXXXXXXXX',
    domain: 'mydomain.com',
    mailingList: 'example', // This will combine with domain. From example it will be like this: example@mydomain.com.
    token: 'Please change here for security', // Everyone see this code. PLEASE CHANGE!!!.
    from: 'John Doe <john@example.com>',
    subjects: [
    	'Hi there',
    	'How are you?',
    	''
    ]

};
