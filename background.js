// Chrome automatically creates a background.html page for this to execute.
// This can access the inspected page via executeScript
// 
// Can use:
// chrome.tabs.*
// chrome.extension.*

chrome.extension.onConnect.addListener(function (port) {

  var extensionListener = function (message, sender, sendResponse) {
    if (message.tabId) {
      if (message.action === 'code' && message.content) {
        // Evaluate script in inspectedPage
        chrome.tabs.executeScript(message.tabId, {code: message.content});
      } else if (message.action === 'script' && message.content) {
        // Attach script to inspectedPage
        chrome.tabs.executeScript(message.tabId, {file: message.content});
      } else {
        console.log("%c[Relaying Message]", "font-weight: bold; color: #e6b800;", message);
        // Pass message to inspectedPage
        chrome.tabs.sendMessage(message.tabId, message, sendResponse);
      }

    // This accepts messages from the inspectedPage and 
    // sends them to the panel
    } else {
      port.postMessage(message);
    }
    sendResponse(message);
  }

  // Listens to messages sent from the panel
  chrome.extension.onMessage.addListener(extensionListener);

  port.onDisconnect.addListener(function(port) {
    chrome.extension.onMessage.removeListener(extensionListener);
  });

  port.onMessage.addListener(function (message) {
    port.postMessage(message);
  });

});

var ports = window.PORTS = {};
var queues = window.QUEUES = {};

var channels = {
  ArchDevToolsPageScript: "ArchDevToolsPanel",
  ArchDevToolsPanel: "ArchDevToolsPageScript"
};

// DevTools / page connection
chrome.runtime.onConnect.addListener(port => {

  console.log("%c[Client Connected]: " + port.name, "font-weight: bold; color: #2eb82e;", port);
  ports[port.name] = port;

  if (queues[port.name] && queues[port.name].length) {
    queues[port.name].forEach(port.postMessage.bind(port));
    queues[port.name] = [];
  }

  var portListener = function(message, sender, sendResponse) {
    console.log("%c[Client Message]: " + sender.name, "font-weight: bold; color: #e6b800;", message);

    if (!channels[sender.name]) {
      throw new Error('NO CHANNEL DEFINED FOR SENDER', sender, { message, port });
    }
    var destination = channels[sender.name], port = ports[destination];

    if (!port) {
      console.log("%c[Message Not Relayed]", "font-weight: bold; color: #cc2900;", message, { ports, sender });
      queues[destination] = queues[destination] || [];
      queues[destination].push(message);
      return;
    }
    console.log("%c[Message Relayed]: " + destination, "font-weight: bold; color: #e6b800;", message, { ports, sender });
    port.postMessage(message);

    if (message.tabId && message.scriptToInject) {
      chrome.tabs.executeScript(message.tabId, { file: message.scriptToInject });
    }
  }

  port.postMessage({ info: "Client connected to background", name: port.name });

  port.onDisconnect.addListener(function() {
    port.onMessage.removeListener(portListener);
    delete ports[port.name];
  });
  port.onMessage.addListener(portListener);
});

// DevTools -> background message
// chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
//   console.log("Runtime message", { request, sender });
//   sendResponse();
// });