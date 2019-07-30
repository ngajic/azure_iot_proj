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

// const iotHubConnectionString = process.env.IotHubConnectionString;
// const eventHubConsumerGroup = process.env.EventHubConsumerGroup;

const iotHubConnectionString = 'HostName=gajicnenad-hub1.azure-devices.net;SharedAccessKeyName=service;SharedAccessKey=0sQ7t60RikGpv0Kd49W16lZ2cbPEEKtQ8xIXaNdIqDk=';
const eventHubConsumerGroup = 'iothubconsumergroup1';

// Redirect requests to the public subdirectory to the root
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res /* , next */) => {
  res.redirect('/');
});

class DeviceData {
  constructor(deviceId) {
    this.deviceId = deviceId;
    this.maxLen = 50;
    this.timeData = new Array(this.maxLen);
    this.temperatureData = new Array(this.maxLen);
    this.calcTemperatureData = new Array(this.maxLen);
    this.mean = 0;
    this.variance = 0;
    this.weight = 0;
    this.lastTemperature = 0;
  }

  addData(time, temperature, calcTemperature) {
    this.timeData.push(time);
    this.temperatureData.push(temperature);
    this.calcTemperatureData.push(calcTemperature || null);

    if (this.timeData.length > this.maxLen) {
      this.timeData.shift();
      this.temperatureData.shift();
      this.calcTemperatureData.shift();
    }
  }
}

  // All the devices in the list (those that have been sending telemetry)
class TrackedDevices {
  constructor() {
    this.devices = [];
  }

  // Find a device based on its Id
  findDevice(deviceId) {
    for (let i = 0; i < this.devices.length; ++i) {
      if (this.devices[i].deviceId === deviceId) {
        return this.devices[i];
      }
    }

    return undefined;
  }
}

const trackedDevices = new TrackedDevices();

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

wss.broadcast = (message) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        const messageData = JSON.parse(message); // message
        console.log(messageData); // crucial!!!!!
        if (!messageData.MessageDate || !messageData.IotData.temperature) {
          return;
        }
        // to be continued...
        const existingDeviceData = trackedDevices.findDevice(messageData.DeviceId);

        if (existingDeviceData) {
          // Calculating mean value of existing device
  
          existingDeviceData.mean = 0;
          for(let i=49; i>0; --i){
            existingDeviceData.mean = existingDeviceData.mean + existingDeviceData.temperatureData[i] ;
          }
          existingDeviceData.mean = existingDeviceData.mean + messageData.IotData.temperature;
          existingDeviceData.mean = existingDeviceData.mean/existingDeviceData.temperatureData.length;
          // Calculating variance of existing device
          messageData.mean = existingDeviceData.mean;

          existingDeviceData.variance = 0;
          for(let i=49; i>0; --i){
            existingDeviceData.variance = existingDeviceData.variance + Math.pow((existingDeviceData.temperatureData[i]-existingDeviceData.mean),2);
          }
          existingDeviceData.variance = existingDeviceData.variance + Math.pow((messageData.IotData.temperature-existingDeviceData.mean),2);
          existingDeviceData.variance = existingDeviceData.variance/existingDeviceData.temperatureData.length;
          messageData.variance = existingDeviceData.variance;

          existingDeviceData.lastTemperature = messageData.IotData.temperature; // cuva se poslednja temperatura
          // poslednja temperatura se dodaje u niz kada se dobije poruka od poslednjeg dodatog uredjaja
          // takodje ova temperatura se koristi za racunanje calcTemperature samo kada se dobije poruka poslednjeg dodatog uredjaja
          
          messageData.calcTmp = trackedDevices.devices[0].calcTemperatureData[0];
          // podaci se dodaju kada se primi poruka poslednjeg dodatog uredjaja u trackedDevices 
          // takodje se tada racuna temperatura u zavisnosti od varijanse uredjaja
          if(trackedDevices.devices[trackedDevices.devices.length - 1].deviceId === existingDeviceData.deviceId){
            // Calculating weight...
          var help = 0;
          for(let i=0; i<trackedDevices.devices.length; ++i){
            if(trackedDevices.devices[i].variance === 0){
              trackedDevices.devices[i].variance = 0.1;
            }
            help = help + 1/trackedDevices.devices[i].variance;
          }
          for(let i=0; i<trackedDevices.devices.length; ++i){
            if(trackedDevices.devices[i].variance === 0){
              trackedDevices.devices[i].variance = 0.1;
            }
            trackedDevices.devices[i].weight = 1/(trackedDevices.devices[i].variance*help);
          }
          var calcTmp = 0;
          for(let i = 0; i<trackedDevices.devices.length; ++i){
              calcTmp = calcTmp + trackedDevices.devices[i].weight*trackedDevices.devices[i].lastTemperature;
            }
          messageData.calcTmp = calcTmp;
          for(let i = 0; i<trackedDevices.devices.length; ++i){
              trackedDevices.devices[i].addData(messageData.MessageDate, trackedDevices.devices[i].lastTemperature, calcTmp)
            }
            // existingDeviceData.addData(messageData.MessageDate, messageData.IotData.temperature, calcTmp);
          }
  
           
  
        } else {
          const newDeviceData = new DeviceData(messageData.DeviceId);
          trackedDevices.devices.push(newDeviceData);
          newDeviceData.addData(messageData.MessageDate, messageData.IotData.temperature, messageData.IotData.temperature);
        }
        //
        message = JSON.stringify(messageData);

        console.log(`Broadcasting data ${message}`);
        client.send(message);
        // Part of code which is sending message to all devices about calculated temperature
        serviceClient.open(function (err) {
          if (err) {
            console.error('Could not connect: ' + err.message);
          } else {
            console.log('Service client connected');
            serviceClient.getFeedbackReceiver(receiveFeedback);
            const payload1 = {
              MessageDate: messageData.MessageDate,
              calcTmp: messageData.calcTmp, // ADDED
            };
            var message1 = new Message('Calculated Temperature');
            message1.ack = 'full';
            message1.messageId = "Calculated Temperature";
            message1.data = JSON.stringify(payload1);
            console.log('Sending message: ' + message1.getData());
            serviceClient.send(targetDevice1, message1, printResultFor('send'));
            serviceClient.send(targetDevice2, message1, printResultFor('send'));
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
        mean: 0, // ADDED
        variance: 0, // ADDED
        calcTmp: 0, // ADDED
      };

      wss.broadcast(JSON.stringify(payload));
    } catch (err) {
      console.error('Error broadcasting: [%s] from [%s].', err, message);
    }
  });
})().catch();