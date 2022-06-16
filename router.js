/**
06/16 先實作判斷是否已經登入、登入、註冊、發信驗證的功能與Page。
 */

var express = require('express');
var parseurl = require('parseurl');
var session = require('express-session');
var cookieParserr = require('cookie-parser');
var bodyParser = require('body-parser');

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
			sessionCreatedTime: new Date().toLocaleTimeString(),
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

app.get('/userProfile', function(req, res) {
	if (!req.session.userProfile.isLogin) {
		res.redirect('/doLogin.html');
	} else {
		res.set('Content-Type', 'text/plain');
		res.end('Your user profile: ' + JSON.stringify(req.session.userProfile) + '.\n');
	}
});

app.post('/login', function(req, res) {
	// fake validation
	// TODO
	console.log(req.body);
	if (req.body.name == 'Jack' && req.body.password == '1234') {
		req.session.userProfile.isLogin = true;
	}

	// redirest
	if (!req.session.userProfile.isLogin) {
		res.redirect('/doLogin.html');
	} else {
		res.redirect('/userProfile');
	}
});


// wildcard entry
app.get('/*', function(req, res) {
	console.log('You reaches /*');
	res.set('Content-Type', 'text/plain');
	res.write('You reach at time: ' + new Date().toLocaleTimeString() + '.\n');
	res.write('Your cookie: ' + JSON.stringify(req.cookies) + '.\n');
	res.end('Your session: ' + JSON.stringify(req.session) + '.\n');
});



app.listen(8081, function(err) {
	if (err)
		throw err;
	console.log('__dirname: ' + __dirname);
	console.log('listening on port 8081');
});