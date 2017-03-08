//@Todo save access token to storage, no refresh every request
var util = require('util');
var express = require('express');

var config = require('./config');
var gcal = require('google-calendar');
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser');
var session = require('express-session');
var Random = require('meteor-random');

var _ = require('underscore');
/*
  ===========================================================================
            Setup express + passportjs server for authentication
  ===========================================================================
*/

var app = express();
var passport = require('passport');
var refresh = require('passport-oauth2-refresh');
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;


app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(session({ secret: '777' }));
app.use(passport.initialize());
app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});


app.listen(8082);
var strategy = new GoogleStrategy({
    clientID: config.consumer_key,
    clientSecret: config.consumer_secret,
    callbackURL: "http://localhost:8082/auth/callback",
    scope: ['openid', 'email', 'https://www.googleapis.com/auth/calendar']
}, function (accessToken, refreshToken, profile, done) {
    profile.accessToken = accessToken;
    if (refreshToken) {
        profile.refreshToken = refreshToken;
    } else {

    }
    return done(null, profile);
});

passport.use(strategy);
refresh.use(strategy);

app.get('/auth',
    passport.authenticate('google', { session: false, access_type: 'offline' }));

app.get('/auth/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    function (req, res) {
        req.session.access_token = req.user.accessToken;
        res.redirect('/');
    });

/*
  ===========================================================================
                               Google Calendar
  ===========================================================================
*/

var itemToBigCal = function (item) {
    return {
        id: item.id,
        title: item.summary,
        desc: item.description,
        start: Math.floor(new Date(item.start.dateTime)),
        end: Math.floor(new Date(item.end.dateTime)),
    };
}

/** GET / - List all events */
app.get('/api/events', function (req, res) {
    var calendarId = config.calendar_id;
    var query = {};
    if  (req.query.timeMin) {
        query.timeMin = req.query.timeMin + '+07:00';
    }
    if  (req.query.timeMax) {
        query.timeMax = req.query.timeMax + '+07:00';
    }
    if  (req.query.query) {
        query.q = req.query.query;
    }
    
    refresh.requestNewAccessToken('google', config.refresh_token, function (err, accessToken, refreshToken) {
        gcal(accessToken).events.list(calendarId, query, function (err, data) {
            if (err) return res.send(500, err);
            if (data.items && data.items.length > 0) {
                return res.json(_.map(data.items, function (item) {
                    return itemToBigCal(item);
                }));
            }
        });
    });
});

/** GET /:eventId - Return a given event */
app.get('/api/events/:eventId', function (req, res) {
    var calendarId = config.calendar_id;
    var eventId = req.params.eventId;
    refresh.requestNewAccessToken('google', config.refresh_token, function (err, accessToken, refreshToken) {
        gcal(accessToken).events.get(calendarId, eventId, function (err, data) {
            if (err) return res.send(500, err);
            return res.json(itemToBigCal(data));
        });
    });
});

/** POST /quick-add - Create a new entity */
app.post('/api/events/quick-add', function (req, res) {
    var calendarId = config.calendar_id;
    var text = req.body.text || 'Hello World';
    refresh.requestNewAccessToken('google', config.refresh_token, function (err, accessToken, refreshToken) {
        gcal(accessToken).events.quickAdd(calendarId, text, function (err, data) {
            if (err) return res.send(500, err);
            return res.json(itemToBigCal(data));
        });
    });
});

/** POST / - Create a new entity */
app.post('/api/events', function (req, res) {
    var calendarId = config.calendar_id;
    var reference = Random.id(4).toUpperCase();
    var roomId = req.body.roomId ? req.body.roomId: config.default_room_id;
    var summary = roomId + '#' + reference;
    var description = 'Name: ' + req.body.name + '\n';
    description += 'Tel: ' + req.body.tel + '\n';
    description += 'E-mail: ' + req.body.email + '\n';
    if (req.body.remark) {
        description += 'Remark: ' + req.body.remark + '\n';
    }
    var startAt = req.body.date + 'T' + req.body.startTime;
    var endAt = req.body.date + 'T' + req.body.endTime;
    var event = {
        'summary': summary,
        'colorId': '6', //yellow ?
        'description': description,
        'start': {
            'dateTime': startAt,
            'timeZone': config.timezone
        },
        'end': {
            'dateTime': endAt,
            'timeZone': config.timezone
        }
    };
    refresh.requestNewAccessToken('google', config.refresh_token, function (err, accessToken, refreshToken) {
        gcal(accessToken).events.insert(calendarId, event, function (err, data) {
            if (err) return res.send(500, err);
            return res.json(itemToBigCal(data));
        });
    });
});

/** PUT /:id - Update a given entity */
// @TODO


/** DELETE /:id - Delete a given entity */
app.delete('/api/events/:eventId', function (req, res) {
    var calendarId = config.calendar_id;
    var eventId = req.params.eventId;
    refresh.requestNewAccessToken('google', config.refresh_token, function (err, accessToken, refreshToken) {
        gcal(accessToken).events.delete(calendarId, eventId, function (err, data) {
            if (err) return res.send(500, err);
            return res.json(data);
        });
    });
});