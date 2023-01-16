const fs = require('fs');
const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const http = require('http').createServer(app);
const WebSocketServer = require('websocket').server;
var wsServer;
var ws_id ;
//const ws = require('socket.io')(http);

const TGCHANNEL = 'devhumor';

const port = process.env.PORT || 3000;
const clients = new Map();

const data = JSON.parse( fs.readFileSync(`./${TGCHANNEL}/${TGCHANNEL}.json`));
const ids = Array.from( data.messages, x => x.id).slice(2);
const count = ids.length;
const messages = new Map(); // message.id: message
data.messages.forEach( msg => messages.set( msg.id, msg));
console.log(`${count} messages found`);

const fields = new Map();
fields.set("id", {label:"Идентификатор поста", get:(item) => item.id});
fields.set("date", {label:"Время поста", get:(item) => item.date});
fields.set("filename", {label:"Название файла картинки", get:(item) => item.photo||item.file||''});
fields.set("filesize", {label:"Размер файла картинки", get:(item) => {
	const filename = item.photo||item.file;
	return (filename) ? fs.statSync(`./${TGCHANNEL}/` + filename)?.size||0 : 0 ;
}});
fields.set("width", {label:"Ширина картинки", get:(item) => item.width||0});
fields.set("height", {label:"Высота картинки", get:(item) => item.height||0});
fs.writeFile('lab5.log','started\n', (err) => { if (err) throw err; });
function log( s) {
	fs.appendFile('lab5.log', s + '\n', (err) => {	if (err) throw err;	});
}

shuffle = (dest, src) => {
	src.forEach( (id, n) => {
		if (n) {
			const i = Math.floor( Math.random() * n) ;
			if (i != n)
				dest [n] = dest [i];
			dest [i] = id;
		} else
			dest [0] = id
	}) ;
}

client_send_item = (c, request_id, index) => {
	c.connection.send(JSON.stringify( {
		event:'item', 
		response: request_id, 
		index: index, 
		item: messages.get( c.index [index])
	}));
}

client_send_error = ( c, request_id, error) => {
	c.connection.send(JSON.stringify({
		event:'error', 
		response: request_id, 
		error_text: error
	}));
}

client_set_keys = (c, msg) => {
	console.log(`${c.id} меняет порядок сортировки на ${msg.keys [0]}`);
	c.fields = msg.keys?.filter( key => fields.has( key)) || ["id"];
	c.connection.send( JSON.stringify( {
		event:'keys', 
		response: msg.request, 
		fields: c.fields
	}));
} 

client_msg = (c, msg) => {
	console.log(`Сообщение из ${c.id} : ${msg.message_text}`);
}

client_log = (c, msg) => {
	log(`client message : ${msg.message_text}`);
}


client_get_item_keys = (c, msg) => {
	const index = msg.index;
	if ((!index) && (index != 0) || (index < 0) || (index >= count)) {
		log(`error : wrong index :\n${JSON.stringify( msg)}`);
		client_send_error(c, msg.request, `неправильный индекс ${index} в ${msg}`)
		return;
	}
	const item = messages.get( c.index [index]);
	if (!item) {
		log(`error : lost item :\n${JSON.stringify( msg)}`);
		client_send_error(c, msg.request, `не найден элемент ${index} в ${msg}`)
		return;
	}
	const keys = c.fields.map( key => fields.get( key).get( item));
	c.connection.send( JSON.stringify( {
		event:'item_key', 
		response: msg.request, 
		index: index, 
		keys: keys
	}));
//	log(`[${msg.sort_id}] : item_key [${index}] : ${c.index [index]} : ${JSON.stringify( keys)}`);
}

client_get_all = (c, msg) => {
	if (msg)
		console.log(`${c.id} попросил прислать всё`);
	for (let n = 0; n < count ; n ++)
		client_send_item( c, null, n);
}

client_get_item = (c, msg) => {
	const index = msg.index || -1;
	if ((index < 0) || (index >= count)) {
		client_send_error(c, msg.request, `неправильный индекс в ${msg}`)
		return;
	}
	client_send_item( c, msg.request, index);
}

client_swap = (c, msg) => {
	var indexes = msg.indexes ;
	if (indexes.length < 2){
		log(`error : lost swap indexes :\n${JSON.stringify( msg)}`);
		client_send_error(c, msg.request, `надо 2 индекса в ${msg}`)
		return;
	}
	const index1 = indexes [0];
	if ((index1 < 0) || (index1 >= count)) {
		log(`error : wrong swap indexes [0] :\n${JSON.stringify( msg)}`);
		client_send_error(c, msg.request, `неправильный первый индекс в ${msg}`)
		return;
	}
	const index2 = indexes [1];
	if ((index2 < 0) || (index2 >= count)) {
		log(`error : wrong swap indexes [1] :\n${JSON.stringify( msg)}`);
		client_send_error(c, msg.request, `неправильный второй индекс в ${msg}`)
		return;
	}
//	log(`[${msg.sort_id}] : [${index1}]:${c.index [index1]} <=> [${index2}]:${c.index [index2]}`);
	const x = c.index [index1];
	c.index [index1] = c.index [index2];
	c.index [index2] = x;

	client_send_item( c, '', index1);
	client_send_item( c, '', index2);
	c.connection.send(JSON.stringify( {
		event:'done', 
		requested:'swap', 
		response: msg.request
	}));
}

client_shuffle = (c, msg) => {
	console.log(`${c.id} перемешал всё`);
	shuffle( c.index, ids);
	c.connection.send(JSON.stringify( {
		event:'done', 
		requested:'shuffle', 
		response: msg.request
	}));
	client_get_all( c, null);
}

const handlers = new Map();
handlers.set("set_keys", (c, msg) => client_set_keys( c, msg));
handlers.set("item_key", (c, msg) => client_get_item_keys( c, msg));
handlers.set("get_all", (c, msg) => client_get_all( c, msg));
handlers.set("get", (c, msg) => client_get_item( c, msg));
handlers.set("swap", (c, msg) => client_swap( c, msg));
handlers.set("shuffle", (c, msg) => client_shuffle( c, msg));
handlers.set("msg", (c, msg) => client_msg( c, msg));
handlers.set("log", (c, msg) => client_log( c, msg));

app.use( express.static(`${__dirname}`));
app.use('/js', express.static(`${__dirname}/client`));
app.use('/css', express.static(`${__dirname}/css`));
app.use('/logo', express.static(`${__dirname}/img`));

app.use('/images', express.static(`${__dirname}/${TGCHANNEL}/images`));
app.use('/photos', express.static(`${__dirname}/${TGCHANNEL}/photos`));
app.use('/stickers', express.static(`${__dirname}/${TGCHANNEL}/stickers`));
app.use('/video_files', express.static(`${__dirname}/${TGCHANNEL}/video_files`));

app.engine('handlebars', handlebars.engine({ defaultLayout: 'main' }));
app.set('views', './views');
app.set('view engine', 'handlebars');

app.get('/', (req, res) => res.render('home',{data:data, count:count, fields:fields}))
app.get('/about', (req, res) => res.render('about'))

app.use((req, res) => {
	res.status(404)
	res.render('404')
})

app.use((err, req, res, next) => {
	console.error(err.message)
	res.status(500)
	res.render('500')
})

http.listen(port, () => console.log(`Express запущен на http://localhost:${port};\nнажмите Ctrl+C для завершения.` ))
wsServer = new WebSocketServer({ httpServer: http, autoAcceptConnections: false});

ws_id = 0;

function ws_allowed( host, origin) {
	return true;
}

wsServer.on('request', (request) => {
	if (! ws_allowed( request.host, request.origin)) {
    	request.reject( 403,'Я тебя не знаю!');
    	console.log(`${new Date()} : Connection from ${request.host} (origin: ${request.origin}) rejected.`);
    	return;
    }
    
    var connection = request.accept( null, request.origin);
	ws_id += 1;
	connection.client_id = ws_id;
	let client = { id: ws_id, connection: connection, index: Array(ids.length), fields: ["id"]}
    console.log(`${new Date()} : Connection #${client.id} from ${request.host} (origin: ${request.origin}) accepted.`);
	clients.set( connection, client) ;
	shuffle( client.index, ids);

	let info = {event:"info", itemsCount: ids.length};
	info.fields = Array.from( fields.entries()).map( f => ({name: f [0], label: f [1].label}));
	info.selected = ["id"];
	connection.send( JSON.stringify( info));

    connection.on('message', function(message) {
        if (message.type !== 'utf8') {
			console.log(`Пришло не текстовое сообщение в ${connection.client_id}`);
			return;
		}
		const msg = JSON.parse( message.utf8Data)||new Object();
		handler = handlers.get( msg.action) ;
		if (handler)
			try {
				handler( clients.get( connection), msg);
			}
			catch (e) {
				console.log(`Ошибка при обработке сообщения :-( в ${connection.client_id}`);
				console.log( message.utf8Data);
				console.error( e);
			}
		  else {
			  console.log(`unrecognized message from ${connection.client_id} : `, message.utf8Data);
		}
	});

    connection.on('close', function(reasonCode, description) {
		clients.delete(connection);
        console.log(`${new Date()} : Peer ${connection.remoteAddress} disconnected.`);
    });
});