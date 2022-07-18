const { Pool } = require('pg');
var nodemailer = require('nodemailer');
var fs = require('fs');

const pool = new Pool({
	host: 'localhost',
	port: 5432,
	database: 'demo_db',
	user: 'postgres',
	password: 'qazxsw'
});

/**
result template:
{
	success: true, msg: [JSON]
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

function queryAccounts() {
	pool.query('select * from accounts;', function(err, res) {
		if (err) {
			console.log(err.stack);
		} else {
			console.log(res.rows);
		}
	});
}

const check_account_text = 'select * from accounts where email = $1 and password = $2;';
const login_account_text = 'update accounts set login_count = login_count + 1, session_time = $3 where email = $1 and password = $2;'

/**
	1. check whether this account exists
	2. plus 1 to the login_count if logined
 */
function login(email, password, session_time, callback) {
	let account = null;
	pool.query(check_account_text, [email, password], function(err, res) {
		console.log(res);
		if (res.rowCount > 0) {
			console.log(res.rows);
			account = res.rows[0];
			pool.query(login_account_text, [email, password, new Date()], function(err, res) {
				if (res.rowCount > 0) {
					// empty rows
					console.log('Login(' + email + ') Success.');
					if (callback) {
						callback({
							success: true, msg: { account: account }
						});
					}
				} else {
					console.log('Not exist.');
				}
			});

		} else {
			console.log('Not exist.');
			if (callback) {
				callback({
					success: false, msg: 'Not exists.'
				});
			}
		}
	});
}

const insert_account_text = 'insert into accounts(email, password, sign_up_time, login_count, session_time)' +
	' values($1, $2, $3, $4, $5) returning *;';
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

	const values = [email, password, new Date(), 1, session_time];
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
				sendEmail();
			}
		}
	});
}

var secret_table = {};
// The value of the secret mapped to the accordingly account will be removed in 30 seconds
var timeout_value = 1000 * 30;

/**
 * Send Email by the name of the account
 */
function sendEmail(account) {
	// Create Secret

	secret_table[account] = Math.random();
	console.log('secret_table: ' + JSON.stringify(secret_table));
	var removeSecret = function() {
		console.log('Remove the secret value of [' + account + '].');
		delete secret_table[account];
		console.log('secret_table: ' + JSON.stringify(secret_table));
	};
	setTimeout(removeSecret, timeout_value);

	// Package the email
	var transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: 'vincentfor0214@gmail.com',
			pass: 'purosmqjaryooztv'
		}
	});
	var mailOptions = {
		from: 'vincentfor0214@gmail.com',
		to: account,
		subject: 'Verify Your Email',
		html: ''
	};
	fs.readFile('demofile1.html', function(err, data) {
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
		});
	});
}

function verifyAccount(account, secret) {
	// TODO
}

function closeConnections() {
	pool.end();
}

function test() {
	// initTables();

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

	sendEmail("shehblockflood@gmail.com");
}

test();