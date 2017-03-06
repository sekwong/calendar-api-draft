//@Todo save access token to storage, no refresh every request
var util = require('util');
var express = require('express');

var config = require('./config');
var gcal = require('google-calendar');
var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser');
var session = require('express-session');
var Random = require('meteor-random');

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

var accessToken = 'ya29.GlsGBJOQTner327ORAkExMXPoxK2GlIPhkE89T7YKBFvz6Q_VRZD3TDBM4ChWJ0Kpl1HZjaRpXeHetyMMwz3et7S7Ekbt3j-QUMb1Ws8qEPlZqI-on1yoheya82h';


/** GET / - List all events */
app.get('/api/events', function (req, res) {
    var calendarId = config.calendar_id;
    var query = {
        timeMin: req.query.timeMin + '+07:00',
        timeMax: req.query.timeMax + '+07:00'
    };
    //refresh.requestNewAccessToken('google', config.refresh_token, function (err, accessToken, refreshToken) {
    // gcal(accessToken).events.list(calendarId, query, function (err, data) {
    //     if (err) return res.send(500, err);
    //     return res.json(data);
    // });
    //});

    gcal(accessToken).events.list(calendarId, query)
    .then(function(err, data) {
        if (err) return res.send(500, err);
        return res.json(data);
    });
});

/** GET /:eventId - Return a given event */
app.get('/api/events/:eventId', function (req, res) {
    var calendarId = config.calendar_id;
    var eventId = req.params.eventId;
    refresh.requestNewAccessToken('google', config.refresh_token, function (err, accessToken, refreshToken) {
        gcal(accessToken).events.get(calendarId, eventId, function (err, data) {
            if (err) return res.send(500, err);
            return res.json(data);
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
            return res.json(data);
        });
    });
});

/** POST / - Create a new entity */
app.post('/api/events', function (req, res) {
    var calendarId = config.calendar_id;
    var reference = Random.id(4).toUpperCase();
    var summary = req.body.roomId + '#' + reference;
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
            return res.json(data);
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