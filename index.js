var winston = require('winston');
var _ = require('lodash');
var restify = require('restify');
var he = require('he');

var fs = require('fs');
var yaml = require('js-yaml');
var config = yaml.safeLoad(fs.readFileSync(__dirname + '/config.yaml', 'utf8')) || {};

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({level:"debug", colorize:true})
    ]
});

var HipChatClient = require('hipchat-client');

var server = restify.createServer({
  name: 'genee-trello2hipchat',
  version: '1.0.0'
});

var client = new restify.createJsonClient({
    url: 'https://api.trello.com'
});

var board2conn = {};

config.connections.forEach(function(conn){
    _.merge(conn, config.common);

    var endpoint = '/1/token/' + conn.trello.token + '/webhooks?key=' + conn.trello.apiKey;
    client.put(endpoint, {
        idModel: conn.trello.boardId,
        callbackURL: conn.trello.callbackURL
    }, function(data, response) {
        if (response.statusCode == 200) {
            logger.info("Webhook for " + conn.name + " was registered");
        } else {
            logger.error(data);
            // logger.error(data.message, data);
        }
    }).on('error',function(err){
        logger.error('something went wrong on the request', err.request.options);
    });

    board2conn[conn.trello.boardId] = conn;

});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser({mapParams: false}));

function verifyWebhookRequest(req) {
    var crypto = require('crypto');
    var secret = config.common.trello.apiSecret;
    var callbackURL = config.common.trello.callbackURL;
    var hash = crypto.createHmac('sha1', secret).update(req._body + callbackURL);
    return hash.digest('base64') == req.headers['x-trello-webhook'];
}

server.head('/notify', function(req, res, next) {
    res.send("welcome!");
    return next();
});

server.post('/notify', function(req, res, next) {
    logger.debug(req.headers);
    logger.debug(req._body);
    
    if (!verifyWebhookRequest(req)) {
        logger.error("failed to verify webhook request.");
        res.send("who are you?");
        return next();
    }
    
    var action = req.body.action;
    var model = req.body.model;
    
    var message = null;

    if (action.data.card) {
        (function(){
            var userName = '<b>' + he.encode(action.memberCreator.fullName) + '</b>';

            var cardName = '<a href="https://trello.com/c/' + action.data.card.shortLink +'">' + he.encode(action.data.card.name) + '</a>';

            var boardName = action.data.boardAfter ? action.data.boardAfter.name : action.data.board.name;
            boardName = '<a href="' + model.shortUrl + '">' + he.encode(boardName) + '</a>';

            var listName = '<b>' + he.encode(action.data.listAfter ? action.data.listAfter.name : action.data.list.name) + '</b>';

            switch (action.type) {
            case 'updateCard':
                message = userName + ' moved ' + cardName + ' to ' + listName + ' (' + boardName + ')';
                break;
            case 'createCard':
                message = userName + ' created ' + cardName + ' in ' + listName + ' (' + boardName + ')';
                break;
            case 'commentCard':
                message = userName + ' commented ' + cardName + ' in ' + listName + ' (' + boardName + '):<br>'
                    + '<quote>' + he.encode(action.data.text) + '</quote>';
                break;
            default:
                message = userName + ' did something to ' + cardName + ' in ' + listName + ' (' + boardName + ')';
            }
        });
    } else if (action.data.list) {
        (function(){
            var userName = '<b>' + he.encode(action.memberCreator.fullName) + '</b>';

            var boardName = action.data.boardAfter ? action.data.boardAfter.name : action.data.board.name;
            boardName = '<a href="' + model.shortUrl + '">' + he.encode(boardName) + '</a>';
    
            var listName = '<b>' + he.encode(action.data.list.name) + '</b>';

            switch (action.type) {
            case 'createList':
                message = userName + ' created ' + listName + ' in ' + boardName;
                break;
            default:
                message = userName + ' did something to ' + listName + ' in ' + boardName;
            }
        });
    }

    try {

        if (!message) throw "unknown message.";
        logger.info(message);

        var conn = board2conn[model.id];
        if (!conn) throw "unknown board.";

        var data = {
          room_id: conn.hipchat.room,
          from: conn.hipchat.sender,
          message: message,
          format: 'html',
          notify: 1
        };
        
        logger.debug(data);
        
        var hipchat = new HipChatClient(conn.hipchat.token);
        hipchat.api.rooms.message(data, function (err, res) {
            if (err) { throw err; }
        });

    } catch (err) {
        logger.error(err);
    }

    res.send("thanks.");
    return next();
});

var port = Number(process.env.PORT || 5000);
server.listen(port, function () {
  logger.info(server.name + ' listening at ' + server.url);
});