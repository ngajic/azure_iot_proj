//*************//
'use strict';

var Client = require('azure-iothub').Client;
var Message = require('azure-iot-common').Message;

var connectionString = 'HostName=gajicnenad-hub1.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=NridmVId7FBNr1IJkFnQZCNhdqbHxpZjo9rSVvYsR/I=';
var targetDevice1 = 'RaspberryPI1';
var targetDevice2 = 'ESP32';

var serviceClient = Client.fromConnectionString(connectionString);
//*************//

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const EventHubReader = require('./scripts/event-hub-reader.js');

const iotHubConnectionString = process.env.IotHubConnectionString;
const eventHubConsumerGroup = process.env.EventHubConsumerGroup;

// Redirect requests to the public subdirectory to the root
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res /* , next */) => {
  res.redirect('/');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

function printResultFor(op) {
  return function printResult(err, res) {
    if (err) console.log(op + ' error: ' + err.toString());
    if (res) console.log(op + ' status: ' + res.constructor.name);
  };
}

function receiveFeedback(err, receiver){
  receiver.on('message', function (msg) {
    console.log('Feedback message:')
    console.log(msg.getData().toString('utf-8'));
  });
}

wss.broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        console.log(`Broadcasting data ${data}`);
        client.send(data);
        // Part of code which is sending message to all devices about calculated temperature
        serviceClient.open(function (err) {
          if (err) {
            console.error('Could not connect: ' + err.message);
          } else {
            console.log('Service client connected');
            serviceClient.getFeedbackReceiver(receiveFeedback);
            var message = new Message('Cloud to device message.');
            message.ack = 'full';
            message.messageId = "My Message ID";
            console.log('Sending message: ' + message.getData());
            serviceClient.send(targetDevice1, message, printResultFor('send'));
            serviceClient.send(targetDevice2, message, printResultFor('send'));
          }
        });
        // ******************* //
      } catch (e) {
        console.error(e);
      }
    }
  });
};

server.listen(process.env.PORT || '3000', () => {
  console.log('Listening on %d.', server.address().port);
});

const eventHubReader = new EventHubReader(iotHubConnectionString, eventHubConsumerGroup);

(async () => {
  await eventHubReader.startReadMessage((message, date, deviceId) => {
    try {
      const payload = {
        IotData: message,
        MessageDate: date || Date.now().toISOString(),
        DeviceId: deviceId,
      };

      wss.broadcast(JSON.stringify(payload));
    } catch (err) {
      console.error('Error broadcasting: [%s] from [%s].', err, message);
    }
  });
})().catch();