/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */
$(document).ready(() => {
  // if deployed to a site supporting SSL, use wss://
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://';
  const webSocket = new WebSocket(protocol + location.host);
  var deviceCounter = 0;
  var mymap;
// var Client = require('../azure-iothub').Client;
// var Message = require('../azure-iot-common').Message;

// var connectionString = 'HostName=gajicnenad-hub1.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=NridmVId7FBNr1IJkFnQZCNhdqbHxpZjo9rSVvYsR/I=';
// var targetDevice = 'ESP32';

// var serviceClient = Client.fromConnectionString(connectionString);

  // A class for holding the last N points of telemetry for a device
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

  // Define the chart axes
  const chartData = {
    datasets: [

      {
        fill: false,
        label: 'Calculated Temperature',
        yAxisID: 'Calculated Temperature',
        borderColor: 'rgba(24, 120, 240, 1)',
        pointBoarderColor: 'rgba(24, 120, 240, 1)',
        backgroundColor: 'rgba(24, 120, 240, 0.4)',
        pointHoverBackgroundColor: 'rgba(24, 120, 240, 1)',
        pointHoverBorderColor: 'rgba(24, 120, 240, 1)',
        spanGaps: true,
      }//,
  //     {
  //       fill: false,
  //       label: 'Temperature Raspberry PI',
  //       yAxisID: 'Temperature 1',
  //       borderColor: 'rgba(255, 204, 0, 1)',
  //       pointBoarderColor: 'rgba(255, 204, 0, 1)',
  //       backgroundColor: 'rgba(255, 204, 0, 0.4)',
  //       pointHoverBackgroundColor: 'rgba(255, 204, 0, 1)',
  //       pointHoverBorderColor: 'rgba(255, 204, 0, 1)',
  //       spanGaps: true,
  //     },
  // //    ADDED BY NENAD
  //     {
  //       fill: false,
  //       label: 'Temperature ESP32',
  //       yAxisID: 'Temperature 1',
  //       borderColor: 'rgba(0, 120, 0, 1)',
  //       pointBoarderColor: 'rgba(0, 120, 0, 1)',
  //       backgroundColor: 'rgba(0, 120, 0, 0.4)',
  //       pointHoverBackgroundColor: 'rgba(0, 120, 0, 1)',
  //       pointHoverBorderColor: 'rgba(0, 120, 0, 1)',
  //       spanGaps: true,
  //     }
    ]
  };

  const chartOptions = {
    title: {
      display: true,
      text: 'Temperature & Fusioned Temperature Real-time Data',
      fontSize: 36,
    },
    scales: {
      yAxes: [
        {
          id: 'Calculated Temperature',
          type: 'linear',
          scaleLabel: {
            labelString: 'Calculated Temperature (ºC)',
            display: true,
          },
          position: 'right',
          ticks: {
            suggestedMin: 16,
            suggestedMax: 36,
          },
        },
        
      {
        id: 'Temperature 1',
        type: 'linear',
        scaleLabel: {
          labelString: 'Temperature (ºC)',
          display: true,
        },
        position: 'left',
        ticks: {
          suggestedMin: 16,
          suggestedMax: 36,
        },
      },

      // ADDED BY NENAD
      // {
      //   id: 'Temperature 2',
      //   type: 'linear',
      //   scaleLabel: {
      //     labelString: 'Temperature (ºC)',
      //     display: true,
      //   },
      //   position: 'left',
      //   ticks: {
      //     suggestedMin: 0,
      //     suggestedMax: 50,
      //   },
      // }
    ]}
  };

  // Get the context of the canvas element we want to select
  const ctx = document.getElementById('iotChart').getContext('2d');
  const myLineChart = new Chart(
    ctx,
    {
      type: 'line',
      data: chartData,
      options: chartOptions,
    });


  // Manage a list of devices in the UI, and update which device data the chart is showing
  // based on selection
  // const listOfDevices = document.getElementById('listOfDevices');
  // function OnSelectionChange() {
  //   const device = trackedDevices.findDevice(listOfDevices[listOfDevices.selectedIndex].text);
  //   chartData.labels = device.timeData;
  //   chartData.datasets[0].data = device.temperatureData;
  //   chartData.datasets[1].data = device.calcTemperatureData;
  // }
  // listOfDevices.addEventListener('change', OnSelectionChange, false);

  // When a web socket message arrives:
  // 1. Unpack it
  // 2. Validate it has date/time and temperature
  // 3. Find or create a cached device to hold the telemetry data
  // 4. Append the telemetry data
  // 5. Update the chart UI
  webSocket.onmessage = function onMessage(message) {
    try {
      const messageData = JSON.parse(message.data);
      console.log(messageData);

      // time and temperature are required
      if (!messageData.MessageDate || !messageData.IotData.temperature) {
        return;
      }
//****************************** */
//OVDE UBACITI OBRADU, racunanje srednje vrednosti za sve senzore, racunanje varijanse i racunanje sjedinjene temperature
//ubaciti sjedinjenu temperaturu umesto humidity-ja, zatim poslati svim povezanim uredjajima poruke o sjedinjenoj temperaturi
//******************************* */
      // find or add device to list of tracked devices
      const existingDeviceData = trackedDevices.findDevice(messageData.DeviceId);


      

      if (existingDeviceData) {
        // Calculating mean value of existing device

        existingDeviceData.mean = messageData.mean;
        // for(let i=49; i>0; --i){
        //   existingDeviceData.mean = existingDeviceData.mean + existingDeviceData.temperatureData[i] ;
        // }
        // existingDeviceData.mean = existingDeviceData.mean + messageData.IotData.temperature;
        // existingDeviceData.mean = existingDeviceData.mean/existingDeviceData.temperatureData.length;
        // Calculating variance of existing device
        // existingDeviceData.variance = 0;
        // for(let i=49; i>0; --i){
        //   existingDeviceData.variance = existingDeviceData.variance + Math.pow((existingDeviceData.temperatureData[i]-existingDeviceData.mean),2);
        // }
        // existingDeviceData.variance = existingDeviceData.variance + Math.pow((messageData.IotData.temperature-existingDeviceData.mean),2);
        existingDeviceData.variance = messageData.variance;

        existingDeviceData.lastTemperature = messageData.IotData.temperature; // cuva se poslednja temperatura
        // poslednja temperatura se dodaje u niz kada se dobije poruka od poslednjeg dodatog uredjaja
        // takodje ova temperatura se koristi za racunanje calcTemperature samo kada se dobije poruka poslednjeg dodatog uredjaja


        // podaci se dodaju kada se primi poruka poslednjeg dodatog uredjaja u trackedDevices 
        // takodje se tada racuna temperatura u zavisnosti od varijanse uredjaja
        if(trackedDevices.devices[trackedDevices.devices.length - 1].deviceId === existingDeviceData.deviceId){
          // Calculating weight...
        // var help = 0;
        // for(let i=0; i<trackedDevices.devices.length; ++i){
        //   if(trackedDevices.devices[i].variance === 0){
        //     trackedDevices.devices[i].variance = 0.1;
        //   }
        //   help = help + 1/trackedDevices.devices[i].variance;
        // }
        // for(let i=0; i<trackedDevices.devices.length; ++i){
        //   if(trackedDevices.devices[i].variance === 0){
        //     trackedDevices.devices[i].variance = 0.1;
        //   }
        //   trackedDevices.devices[i].weight = 1/(trackedDevices.devices[i].variance*help);
        // }
        // var calcTmp = 0;
        // for(let i = 0; i<trackedDevices.devices.length; ++i){
        //     calcTmp = calcTmp + trackedDevices.devices[i].weight*trackedDevices.devices[i].lastTemperature;
        //   }
        for(let i = 0; i<trackedDevices.devices.length; ++i){
            trackedDevices.devices[i].addData(messageData.MessageDate, trackedDevices.devices[i].lastTemperature, messageData.calcTmp)
          }
          // existingDeviceData.addData(messageData.MessageDate, messageData.IotData.temperature, calcTmp);
        }

         

      } else {
        
        const newDeviceData = new DeviceData(messageData.DeviceId);
        trackedDevices.devices.push(newDeviceData);
        newDeviceData.addData(messageData.MessageDate, messageData.IotData.temperature, messageData.IotData.temperature);
       
        var red = Math.round(Math.random()*255);
        var green = Math.round(Math.random()*255);
        var blue = Math.round(Math.random()*255);
        const tmp = {
          fill: false,
          label: messageData.DeviceId,
          yAxisID: 'Temperature 1',
          borderColor: 'rgba('+ red +','+ green +','+ blue +', 1)',
          pointBoarderColor: 'rgba('+ red +','+ green +','+ blue +', 1)',
          backgroundColor: 'rgba('+ red +','+ green +','+ blue +', 0.4)',
          pointHoverBackgroundColor: 'rgba('+ red +','+ green +','+ blue +', 1)',
          pointHoverBorderColor: 'rgba('+ red +','+ green +','+ blue +', 1)',
          spanGaps: true,
        };

        if(deviceCounter === 0){
          chartData.labels = trackedDevices.devices[0].timeData;
          chartData.datasets[0].data = trackedDevices.devices[0].calcTemperatureData;
          ++deviceCounter;
          mymap = L.map('mapid', {center: [44.78, 20.5], minZoom: 2, zoom: 13}); // create open street map
          L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: 18,
            id: 'mapbox.streets',
            accessToken: 'pk.eyJ1IjoiZ2FqaWNuZW5hZDYiLCJhIjoiY2swMTAzbmdqMDkxYTNubGM2enpyYXNicyJ9.5UXxv_UMO-kLtujNsxCObQ'
          }).addTo(mymap);
          var circle = L.circle([messageData.IotData.latitude, messageData.IotData.longitude], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.5,
            radius: 5000
          }).addTo(mymap);
        }
        var marker = L.marker([messageData.IotData.latitude, messageData.IotData.longitude]).addTo(mymap);
        marker.bindPopup("<b>"+ messageData.DeviceId +"</b>").openPopup();

        chartData.datasets.push(tmp);
        chartData.datasets[deviceCounter].data = trackedDevices.devices[deviceCounter - 1].temperatureData;
      
        // // add device to the UI list
        // const node = document.createElement('option');
        // const nodeText = document.createTextNode(messageData.DeviceId);
        // node.appendChild(nodeText);
        // listOfDevices.appendChild(node);

        // // if this is the first device being discovered, auto-select it
        // if (listOfDevices.selectedIndex === -1) {
        //   listOfDevices.selectedIndex = 0;
        //   OnSelectionChange();
        // }
        ++deviceCounter;
      }

      myLineChart.update();
    } catch (err) {
      console.error(err);
    }
  };
});