/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

"use strict";

// Import dependencies and set up http server
const express = require("express"),
  { urlencoded, json } = require("body-parser"),
  crypto = require("crypto"),
  path = require("path"),
  Receive = require("./services/receive"),
  GraphApi = require("./services/graph-api"),
  User = require("./services/user"),
  config = require("./services/config"),
  i18n = require("./i18n.config"),
  app = express();

// Object to store known users.
var users = {};

// Parse application/x-www-form-urlencoded
app.use(
  urlencoded({
    extended: true
  })
);

// Parse application/json. Verify that callback came from Facebook
app.use(json({ verify: verifyRequestSignature }));

// Serving static files in Express
app.use(express.static(path.join(path.resolve(), "public")));

// Find the URL we're serving from
app.all("*", function(req, res, next) {
  // "x-forwarded-proto" will have https even when tunnelling to local
  const reqProtocol = req.get("x-forwarded-proto")
    ? req.get("x-forwarded-proto").split(",")[0]
    : req.get("protocol");
  const reqAppUrl = reqProtocol + "://" + req.get("host");
  if (config.appUrl != reqAppUrl) {
    config.appUrl = reqAppUrl;
    console.log(`Updated appUrl to ${config.appUrl}`);
  }
  next();
});

// Respond with index file when a GET request is made to the homepage
app.get("/", function(_req, res) {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Add support for GET requests to our webhook
// Used to verify the webhook
app.get("/webhook", (req, res) => {
  // Parse the query params
  console.log("Got /webhook");
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks the mode and token sent is correct
    if (mode === "subscribe" && token === config.verifyToken) {
      // Responds with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  } else {
    console.warn("Got /webhook but without needed parameters.");
  }
});

// Add support for POST requests to our webhook
// Called whenever messages occur in the conversation.
app.post("/webhook", (req, res) => {
  let body = req.body;

  console.log(`\u{1F7EA} Received webhook:`);
  console.dir(body, { depth: null });

  // Check if this is an event from a page subscription
  if (body.object === "instagram") {
    // Return a '200 OK' response to all requests
    res.status(200).send("EVENT_RECEIVED");

    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(async function(entry) {
      // Handle Page Changes event
      if ("changes" in entry) {
        let receiveMessage = new Receive();
        if (entry.changes[0].field === "comments") {
          let change = entry.changes[0].value;
          if (entry.changes[0].value) console.log("Got a comments event");
          return receiveMessage.handlePrivateReply("comment_id", change.id);
        }
      }

      if (!("messaging" in entry)) {
        console.warn("No messaging field in entry. Possibly a webhook test.");
        return;
      }

      // Iterate over webhook events - there may be multiple
      entry.messaging.forEach(async function(webhookEvent) {
        // Discard uninteresting events
        if (
          "message" in webhookEvent &&
          webhookEvent.message.is_echo === true
        ) {
          console.log("Got an echo");
          return;
        }

        // Get the sender IGSID
        let senderIgsid = webhookEvent.sender.id;

        if (!(senderIgsid in users)) {
          // First time seeing this user
          let user = new User(senderIgsid);
          let userProfile = await GraphApi.getUserProfile(senderIgsid);
          if (userProfile) {
            user.setProfile(userProfile);
            users[senderIgsid] = user;
            console.log(`Created new user profile`);
            console.dir(user);
          }
        }
        let receiveMessage = new Receive(users[senderIgsid], webhookEvent);
        return receiveMessage.handleMessage();
      });
    });
  } else if (body.object === "page") {
    // Catch if the event came from Messenger webhook instead of Instagram
    console.warn(
      `Received Messenger "page" object instead of "instagram" message webhook.`
    );
    res.sendStatus(404);
  } else {
    // Return a '404 Not Found' if event is not recognized
    console.warn(`Unrecognized POST to webhook.`);
    res.sendStatus(404);
  }
});

// Verify that the callback came from Facebook.
function verifyRequestSignature(req, res, buf) {
  const signature = req.headers["x-hub-signature"];

  if (!signature) {
    console.warn(`Couldn't find "x-hub-signature" in headers.`);
  } else {
    const elements = signature.split("=");
    const signatureHash = elements[1];
    const expectedHash = crypto
      .createHmac("sha1", config.appSecret)
      .update(buf)
      .digest("hex");
    if (signatureHash != expectedHash) {
      throw new Error(
        "Couldn't validate the request signature. Confirm your App Secret."
      );
    }
  }
}

async function main() {
  // Check if all environment variables are set
  config.checkEnvVariables();

  // Set configured locale
  if (config.locale) {
    i18n.setLocale(config.locale);
  }

  const iceBreakers = [
    {
      question: i18n.__("menu.support"),
      payload: "CARE_SALES"
    },
    {
      question: i18n.__("menu.order"),
      payload: "SEARCH_ORDER"
    },
    {
      question: i18n.__("menu.help"),
      payload: "CARE_HELP"
    },
    {
      question: i18n.__("menu.suggestion"),
      payload: "CURATION"
    }
  ];

  // Set our Icebreakers upon launch
  await GraphApi.setIcebreakers(iceBreakers);

  const persistentMenu = [
    {
      locale: "default",
      call_to_actions: [
        {
          type: "postback",
          title: "Talk to an agent",
          payload: "CARE_HELP"
        },
        {
          type: "postback",
          title: "Outfit suggestions",
          payload: "CURATION"
        },
        {
          type: "web_url",
          title: "Shop now",
          url: "https://www.originalcoastclothing.com/"
        }
      ]
    }
  ];

  // Set our Persistent Menu upon launch
  await GraphApi.setPersistentMenu(persistentMenu);

  // Set our page subscriptions
  await GraphApi.setPageSubscriptions();

  // Listen for requests :)
  var listener = app.listen(config.port, function() {
    console.log(`The app is listening on port ${listener.address().port}`);
  });
}

main();
