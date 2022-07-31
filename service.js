const { Pool } = require('pg');
var nodemailer = require('nodemailer');
var fs = require('fs');
var pool = null;

/**
result template:
{
	success: true, msg: {account: '', because: ''}
}
 */

/**
email.
password. it needs to be encrypted, but I can do it later at the end of this project.
Timestamp of user sign up.
Number of times logged in.
Timestamp of the last user session. For users with cookies, session and login may be different, since the user may not need to log in to start a new session.
 */
const create_account_text = 'create table if not exists accounts(' +
	'email varchar(255) not null,' +
	'password varchar(255) not null,' +
	'sign_up_time timestamp not null,' +
	'login_count integer not null,' +
	'session_time timestamp,' +
	'account_verified boolean not null default false,' +
	'secret varchar(255) not null,' +
	'primary key(email)' +
	');';

function initTables() {
	console.log('sql: ' + create_account_text);
	pool.query(create_account_text, function(err, res) {
		if (err) {
			console.log(err.stack);
		} else {
			console.log('table has been established.');
		}
	});
}

const retrieve_account_secret = 'select email, secret from accounts;';

function initSecretTable() {
	pool.query(retrieve_account_secret, function(err, res) {
		if (err) {
			console.log(err.stack);
		} else {
			console.log('secret: ' + JSON.stringify(res.rows));
			for (let i = 0; i < res.rowCount; i++) {
				secret_table[res.rows[0].email] = res.rows[0].secret;
			}
			console.log('secret_table: %s', JSON.stringify(secret_table));
		}
	});
}

function initService() {
	// init parameters
	let PropertiesReader = require('properties-reader');
	let properties = PropertiesReader('./config/config.properties');

	let db_host = properties.get("db_host");
	let db_port = properties.get("db_port");
	let db_database = properties.get("db_database");
	let db_user = properties.get("db_user");
	let db_password = properties.get("db_password");

	let email_service = properties.get("email_service");
	let email_sender = properties.get("email_sender");
	let email_password = properties.get("email_password");

	/*
		console.log(properties.get("email_service"));
		console.log(properties.get("email_sender"));
		console.log(properties.get("email_password"));
		console.log(properties.get("db_host"));
		console.log(properties.get("db_port"));
		console.log(properties.get("db_database"));
		console.log(properties.get("db_user"));
		console.log(properties.get("db_password"));
	*/

	pool = new Pool({
		host: db_host,
		port: db_port,
		database: db_database,
		user: db_user,
		password: db_password
	});

	transporter = nodemailer.createTransport({
		service: email_service,
		auth: {
			user: email_sender,
			pass: email_password
		}
	});
	mailOptions = {
		from: email_sender,
		to: null,
		subject: null,
		html: ''
	};

	initTables();
	initSecretTable();
}

function queryAccounts() {
	pool.query('select * from accounts;', function(err, res) {
		if (err) {
			console.log(err.stack);
		} else {
			console.log(res.rows);
		}
	});
}

const check_account_text = 'select * from accounts where email = $1;';
const login_account_text = 'update accounts set login_count = login_count + 1, session_time = $3 where email = $1 and password = $2;'

/**
	1. check whether this account exists
	2. plus 1 to the login_count if logined
 */
function login(email, password, session_time, callback) {
	let account = null;
	let result = {
		success: null, msg: { account: null }
	};
	pool.query(check_account_text, [email], function(err, res) {
		if (res.rowCount > 0) {
			account = res.rows[0];
			result.msg.account = account;
			console.log(account);
			if (account.password == password) {
				if (account['account_verified']) {
					console.log('Login Success: Account %s exists with the correct password and been verified.', email);
					result.success = true;
					// update login_count
					pool.query(login_account_text, [email, password, session_time], function(err, res) {
						console.log('Account %s has been updated.', email);
					});

				} else {
					console.log('Login Failure: Account %s exists but is not verified.', email);
					result.success = false;
					result['msg']['because'] = 'Not verified!';
				}
			} else {
				console.log('Login Failure: Account %s exists but the password is not correct.', email);
				result.success = false;
				result['msg']['because'] = 'Wrong Password!';
			}

		} else {
			console.log('Login Failure: Account %s does not exist.', email);
			result.success = false;
			result['msg']['because'] = 'Not exist';
		}
		if (callback) {
			callback(result);
		}
	});
}

const insert_account_text = 'insert into accounts(email, password, sign_up_time, login_count, session_time, secret)' +
	' values($1, $2, $3, $4, $5, $6) returning *;';
/*
Use the email as the user account
 */

/*
Only accounts that have email verified can access the simple dashboard. 
Users that have not verified email will only see a button or link that says “Resend Email Verification”, 
and clicking on this link will resend the same email verification.
Only accounts created via email and password must be verified with email verification.
Facebook and Google OAuth sign up accounts do not need to send email verification, and can immediately access the simple dashboard.
*/
function register(email, password, session_time, callback) {
	// Create Secret
	secret_table[email] = Math.random();
	console.log('Add secret to secret_table[' + email + ']: ' + JSON.stringify(secret_table));

	const values = [email, password, new Date(), 1, session_time, secret_table[email]];
	pool.query(insert_account_text, values, function(err, res) {
		if (err) {
			console.log(err.stack);
			if (callback) {
				callback({ success: false, msg: err.stack });
			}
		} else {
			console.log(res.rows);
			if (callback) {
				callback({ success: true, msg: { account: res.rows[0] } });
			}
		}
	});
}

var secret_table = {};
// The value of the secret mapped to the accordingly account will be removed in 30 seconds
var transporter = null;
var mailOptions = null;
/**
 * Send Email by the name of the account
 */
function sendEmail(account, callback) {

	// Package the email
	mailOptions['to'] = account;
	mailOptions['subject'] = 'Verify Your Email';
	fs.readFile('email_template.html', function(err, data) {
		if (err) {
			console.log(err);
			return;
		}
		let secret = secret_table[account];
		let content = new String(data);
		content = content.replace('${account}', account);
		content = content.replace('${secret}', secret);
		mailOptions.html = content;
		console.log(mailOptions);
		// Send the email
		transporter.sendMail(mailOptions, function(error, info) {
			if (error)
				console.log(error);
			else
				console.log('Email sent: %s', info.response);
			if (callback)
				callback();
		});
	});
}

const verify_account_text = 'update accounts set account_verified = true where email = $1;';

function verifyAccount(account, secret, callback) {
	let result = {
		success: null, msg: { account: account }
	};

	if (secret_table[account] == secret) {
		console.log('the secret of this account ' + account + ' is right.');
		// Update for the qualification
		pool.query(verify_account_text, [account], function(err, res) {

			if (res.rowCount > 0) {
				// empty rows
				console.log('Verify(' + account + ') Success.');
				result['success'] = true;
			} else {
				console.log('Account ' + account + ' does not exist.');
				result['success'] = false;
			}

			if (callback) {
				callback(result);
			}
		});

	} else {
		console.log('the secret of this account ' + account + ' is not right.');
		if (callback) {
			callback(result);
		}
	}
}


const update_password_text = 'update accounts set password = $2 where email = $1;'

/**
	1. check whether this account exists
	2. plus 1 to the login_count if logined
 */
function resetPassword(email, newPassword, callback) {
	let result = {
		success: null, msg: {}
	};
	pool.query(update_password_text, [email, newPassword], function(err, res) {
		// console.log('res: %s', JSON.stringify(res));
		console.log('res.rowCount: %d', res.rowCount);
		if (res.rowCount > 0) {
			result.success = true;
			result['msg']['because'] = 'Password has been changed!';
		} else {
			result.success = false;
			result['msg']['because'] = 'Password has not been changed!';
		}
		if (callback) {
			callback(result);
		}
	});
}


function closeConnections() {
	pool.end();
}

exports.login = login;
exports.register = register;
exports.sendEmail = sendEmail;
exports.verifyAccount = verifyAccount;
exports.closeConnections = closeConnections;
exports.initService = initService;
exports.resetPassword = resetPassword;

exports.test = function() {
	// initTables();
	// initSecretTable();
	initService();

	let email = 'vincentfor1234@gmail.com';
	let password = '1234';
	let date = new Date();
	// Test Area
	// register('vincentfor1234@gmail.com', '1234', new Date(), (result) => { console.log('Is this registry successful? ' + result.success) });
	// queryAccounts();

	// TODO Building the prototype of my login function.
	/*
	login(email, password, date, function(result) {
		console.log('success: %s, msg: %s.', result.success, JSON.stringify(result.msg));
	});
	*/

	// sendEmail("shehblockflood@gmail.com");
	// TODO I should link rounters.
	// secret_table['vincentfor1234@gmail.com'] = '1234';
	// verifyAccount('vincentfor1234@gmail.com', '1234');
}

