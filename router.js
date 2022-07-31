/**
06/16 先實作判斷是否已經登入、登入、註冊、發信驗證的功能與Page。
07/28 註冊跟信箱驗證都完成了，記住要盡量把Page流程的控制放在router，有要等待的就用Callback來決定去哪。
 */
var express = require('express');
var parseurl = require('parseurl');
var session = require('express-session');
var cookieParserr = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');
var service = require('./service');
var util = require('util');

var app = express();

app.use(cookieParserr());

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

app.use(express.static(__dirname + '/public'));

app.use(session({
	secret: 'keyborad cat', //用來簽章 sessionID 的cookie, 可以是一secret字串或是多個secret組成的一個陣列。如果是陣列, 只有第一個元素會被簽到 sessionID cookie裡。而在驗證請求中的簽名時，才會考慮所有元素。
	resave: false, // 強制將session 存回 session store, 即使它沒有被修改。預設是 true
	saveUninitialized: true,// 強制將未初始化的session存回 session store，未初始化的意思是它是新的而且未被修改。
	cookie: { secure: false }// if true then it requires an https-enabled website.It only supports http by default.
}));

// intercept every request and init the session
app.use(function(req, res, next) {
	// check whether it's a new session and create a blank user info.
	if (!req.session.userProfile) {
		var ip = req.socket.remoteAddress;
		req.session.userProfile = {
			isLogin: false,
			sessionCreatedTime: new Date(),
			userIp: ip,
			name: null,
			email: null
		};
	}

	// log
	let str = 'Time: ' + new Date().toTimeString() + '\n' +
		'Path: ' + parseurl(req).pathname + '\n' +
		'Cookie: ' + JSON.stringify(req.cookies) + '\n' +
		'Session: ' + JSON.stringify(req.session) + '\n';
	console.log(str);

	next();
});

var userProfile_template;
fs.readFile('./userProfile_template.html', function(err, data) {
	if (err) {
		console.log(err);
		return;
	}
	userProfile_template = new String(data);
	// console.log('userProfile_template: ' + userProfile_template);
});

app.get('/userProfile', function(req, res) {
	if (!req.session.userProfile.isLogin) {
		res.redirect('/doLogin.html');
	} else {
		res.set('Content-Type', 'text/html; charset=utf-8');
		let name = req.session.userProfile.name;
		let email = req.session.userProfile.email;
		let output = userProfile_template.replace('${name}', name).replace('${email}', email);
		res.end(output);
	}
});


var doLogin_template_empty_data = '';
var doLogin_template_wrong_password = '';
var doLogin_template_account_not_exists = '';

fs.readFile('./public/doLogin.html', function(err, data) {
	if (err) {
		console.log(err);
		return;
	}
	doLogin_template = new String(data);
	console.log('load doLogin.html for the templates.');

	doLogin_template_empty_data = doLogin_template.replace("<div style='color:red' id='login_error'></div>", "<div style='color:red' id='login_error'>empty email or password.</div>");
	// console.log('doLogin_template_empty_data: ' + doLogin_template_empty_data);

	doLogin_template_wrong_password = doLogin_template.replace("<div style='color:red' id='login_error'></div>", "<div style='color:red' id='login_error'>wrong password!</div>");
	// console.log('doLogin_template_wrong_password: ' + doLogin_template_wrong_password);

	doLogin_template_account_not_exists = doLogin_template.replace("<div style='color:red' id='login_error'></div>", "<div style='color:red' id='login_error'>account does not exist!</div>");
	// console.log('doLogin_template_account_not_exists: ' + doLogin_template_account_not_exists);
});
/**
req.session.userProfile = {
	isLogin: false,
	sessionCreatedTime: new Date().toLocaleTimeString(),
	userIp: ip,
	name: null,
	email: null
};
 */
app.post('/login', function(req, res) {
	// TODO
	console.log('/login with %s', JSON.stringify(req.body));
	let email = req.body.email;
	let password = req.body.password;
	let session_time = req.session.userProfile.sessionCreatedTime;
	if (email == '' || password == '') {
		res.end(doLogin_template_empty_data);
	}
	service.login(email, password, session_time, function(result) {
		if (result.success) {
			req.session.userProfile.isLogin = true;
			req.session.userProfile.email = email;
			req.session.userProfile.password = result.msg.account.password;
			if (!req.session.userProfile.name)
				req.session.userProfile.name = email;
			res.redirect('/userProfile');
		} else {
			req.session.userProfile.isLogin = false;
			if (result.msg['because'] == 'Wrong Password!') {
				res.end(doLogin_template_wrong_password);
			} else if (result.msg['because'] == 'Not verified!') {
				res.redirect('/resendEmail.html');
			} else if (result.msg['because'] == 'Not exist') {
				res.end(doLogin_template_account_not_exists);
			}
		}
	});


});

var doRegister_template_account_duplicate = '';
var doRegister_template_email_not_accepted = '';
var doRegister_template_passwords_not_matched = '';
var doRegister_template_password_not_accepted = '';

fs.readFile('./public/doRegister.html', function(err, data) {
	if (err) {
		console.log(err);
		return;
	}
	doRegister_template = new String(data);
	console.log('load doRegister.html for the templates.');

	doRegister_template_account_duplicate = doRegister_template.replace("<div id='register_error'></div>", "<div id='register_error'>the account already exists.</div>");
	// console.log('doRegister_template_account_duplicate: ' + doRegister_template_account_duplicate);

	doRegister_template_email_not_accepted = doRegister_template.replace("<div id='register_error'></div>", "<div id='register_error'>the email are not accepted.</div>");
	// console.log('doRegister_template_email_not_accepted: ' + doRegister_template_email_not_accepted);

	doRegister_template_passwords_not_matched = doRegister_template.replace("<div id='register_error'></div>", "<div id='register_error'>the two passwords are not match.</div>");
	// console.log('doRegister_template_passwords_not_matched: ' + doRegister_template_passwords_not_matched);

	doRegister_template_password_not_accepted = doRegister_template.replace("<div id='register_error'></div>", "<div id='register_error'>the password is not accepted.</div>");
	// console.log('doRegister_template_password_not_accepted: ' + doRegister_template_password_not_accepted);
});

app.post('/register', function(req, res) {
	console.log(req.body);
	let email = req.body.email;
	let password1 = req.body.password1;
	let password2 = req.body.password2;

	if (email == '' || password1 == '' || password2 == '') {
		console.log("the email or the password is empty.")
		res.redirect('/doRegister.html');
		return;
	}

	if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g.test(email)) {
		console.log("the email is not accepted.")
		res.end(doRegister_template_email_not_accepted);
		return;
	}

	/**
		contains at least one lower character 
		contains at least one upper character 
		contains at least one digit character 
		contains at least one special character
		contains at least 8 characters
	 */
	var password_pattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[-+_!@#$%^&*.,?])(?=^.{8,15}$)/g;

	if (password1 == password2) {
		console.log('the two passwords are match.');
		if (password_pattern.test(password1)) {
			console.log('the password is accepted.');
			// register and send an email
			// register(email, password, session_time, callback)
			service.register(email, password1, req.session.userProfile.sessionCreatedTime, function(result) {
				if (result['success']) {
					console.log('The account ' + email + ' has been added, so it\'s time to send an email for verification');
					service.sendEmail(email);
					res.redirect('/afterRegister.html');
				} else {
					console.log('The account already exists.');
					res.end(doRegister_template_account_duplicate);
				}
			});
		} else {
			console.log('the password is not accepted.');
			res.end(doRegister_template_password_not_accepted);

		}
	} else {
		console.log('the two passwords are not match.');
		res.end(doRegister_template_passwords_not_matched);

	}

});

app.get('/resendEmail', function(req, res) {
	service.sendEmail(req.query.email, function() {
		res.redirect('/afterRegister.html');
	});
});

app.get('/verification', function(req, res) {
	let account = req.query.account;
	let secret = req.query.secret;
	console.log("account is %s, secret is %s.", account, secret);
	service.verifyAccount(account, secret, function(result) {
		console.log('account ' + account + ' is ' + (result.success ? 'verified.' : 'not verified.'));
		if (result.success) {
			res.redirect('/verificationSuccess.html');
		} else {
			res.redirect('/verificationFailure.html');
		}

	});

});


app.post('/resetPassword', function(req, res) {
	console.log(req.body);
	let email = req.session.userProfile.email;
	let oldPassword = req.body.oldPassword;
	let newPassword1 = req.body.newPassword1;
	let newPassword2 = req.body.newPassword2;

	// validate the old password
	if (oldPassword != req.session.userProfile.password) {
		res.redirect('/resetPassword_Error_WrongOldPassword.html');
		return;
	}

	// validate the new password
	if (newPassword1 == '' || newPassword2 == '') {
		console.log('the two new passwords should both be written.');
		res.redirect('/resetPassword_Error_BadPasswordFormat.html');
		return;
	}
	if (newPassword1 != newPassword2) {
		console.log('the two passwords are not match.');
		res.redirect('/resetPassword_Error_PasswordsAreUnmatched.html');
		return;
	}

	/**
		contains at least one lower character 
		contains at least one upper character 
		contains at least one digit character 
		contains at least one special character
		contains at least 8 characters
	 */
	var password_pattern = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[-+_!@#$%^&*.,?])(?=^.{8,15}$)/g;
	if (!password_pattern.test(newPassword1)) {
		console.log('this format of the new password is not accepted.');
		res.redirect('/resetPassword_Error_BadPasswordFormat.html');
		return;
	}

	// Update the password in db
	service.resetPassword(email, newPassword1, function(result) {
		if (result['success']) {
			console.log('The the password of this account[' + email + '] has been changed.');
			req.session.userProfile.password = newPassword1;
			res.redirect('/userProfile');
		} else {
			console.log('The the password of this account[' + email + '] hasn\'t been changed.');
			res.redirect('/resetPassword.html');
		}
	});
});

// wildcard entry for test
app.get('/*', function(req, res) {
	console.log('Path: /*');
	res.set('Content-Type', 'text/plain');
	res.write('You reach at time: ' + new Date().toLocaleTimeString() + '.\n');
	res.write('Your cookie: ' + JSON.stringify(req.cookies) + '.\n');
	res.end('Your session: ' + JSON.stringify(req.session) + '.\n');
});

app.listen(8081, function(err) {
	if (err)
		throw err;
	service.initService();
	console.log('__dirname: ' + __dirname);
	console.log('listening on port 8081');
});