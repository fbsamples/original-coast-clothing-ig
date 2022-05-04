/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Instagram For Original Coast Clothing
 *
 */

"use strict";

const Curation = require("./curation"),
  Order = require("./order"),
  Response = require("./response"),
  Care = require("./care"),
  Survey = require("./survey"),
  GraphApi = require("./graph-api"),
  i18n = require("../i18n.config");

module.exports = class Receive {
  constructor(user, webhookEvent) {
    this.user = user;
    this.webhookEvent = webhookEvent;
  }

  // Check if the event is a message or postback and
  // call the appropriate handler function
  handleMessage() {
    let event = this.webhookEvent;

    let responses;

    try {
      if (event.message) {
        let message = event.message;

        if (message.is_echo) {
          return;
        } else if (message.quick_reply) {
          responses = this.handleQuickReply();
        } else if (message.attachments) {
          responses = this.handleAttachmentMessage();
        } else if (message.text) {
          responses = this.handleTextMessage();
        }
      } else if (event.postback) {
        responses = this.handlePostback();
      } else if (event.referral) {
        responses = this.handleReferral();
      }
    } catch (error) {
      console.error(error);
      responses = {
        text: `An error has occured: '${error}'. We have been notified and \
        will fix the issue shortly!`
      };
    }

    if (!responses) {
      return;
    }

    if (Array.isArray(responses)) {
      let delay = 0;
      for (let response of responses) {
        this.sendMessage(response, delay * 2000);
        delay++;
      }
    } else {
      this.sendMessage(responses);
    }
  }

  // Handles messages events with text
  handleTextMessage() {
    console.log(
      `Received text from user '${this.user.name}' (${this.user.igsid}):\n`,
      this.webhookEvent.message.text
    );

    let message = this.webhookEvent.message.text.trim().toLowerCase();

    let response;

    if (
      message.includes("start over") ||
      message.includes("get started") ||
      message.includes("hi")
    ) {
      response = Response.genNuxMessage(this.user);
    } else if (Number(message)) {
      // Assume numeric input ("123") to be an order number
      response = Order.handlePayload("ORDER_NUMBER");
    } else if (message.includes("#")) {
      // Input with # is treated as a suggestion
      response = Survey.handlePayload("CSAT_SUGGESTION");
    } else if (message.includes(i18n.__("care.help").toLowerCase())) {
      let care = new Care(this.user, this.webhookEvent);
      response = care.handlePayload("CARE_HELP");
    } else {
      response = [
        Response.genText(
          i18n.__("fallback.any", {
            message: this.webhookEvent.message.text
          })
        ),
        Response.genText(i18n.__("get_started.guidance")),
        Response.genQuickReply(i18n.__("get_started.help"), [
          {
            title: i18n.__("menu.suggestion"),
            payload: "CURATION"
          },
          {
            title: i18n.__("menu.help"),
            payload: "CARE_HELP"
          },
          {
            title: i18n.__("menu.start_over"),
            payload: "GET_STARTED"
          }
        ])
      ];
    }

    return response;
  }

  // Handle mesage events with attachments
  handleAttachmentMessage() {
    let response;

    // Get the attachment
    let attachment = this.webhookEvent.message.attachments[0];
    console.log("Received attachment:", `${attachment} for ${this.user.igsid}`);

    response = Response.genQuickReply(i18n.__("fallback.attachment"), [
      {
        title: i18n.__("menu.help"),
        payload: "CARE_HELP"
      },
      {
        title: i18n.__("menu.start_over"),
        payload: "GET_STARTED"
      }
    ]);

    return response;
  }

  // Handle mesage events with quick replies
  handleQuickReply() {
    // Get the payload of the quick reply
    let payload = this.webhookEvent.message.quick_reply.payload;

    return this.handlePayload(payload);
  }

  // Handle postbacks events
  handlePostback() {
    let postback = this.webhookEvent.postback;

    // Check for the special Get Starded with referral
    let payload;
    if (postback.referral && postback.referral.type == "OPEN_THREAD") {
      payload = postback.referral.ref;
    } else {
      // Get the payload of the postback
      payload = postback.payload;
    }
    return this.handlePayload(payload.toUpperCase());
  }

  // Handles referral events
  handleReferral() {
    // Get the payload of the postback
    let payload = this.webhookEvent.referral.ref.toUpperCase();

    return this.handlePayload(payload);
  }

  handlePayload(payload) {
    console.log(`Received Payload: ${payload} for user ${this.user.igsid}`);

    let response;

    // Set the response based on the payload
    if (
      payload === "GET_STARTED" ||
      payload === "DEVDOCS" ||
      payload === "GITHUB"
    ) {
      response = Response.genNuxMessage(this.user);
    } else if (payload.includes("CURATION") || payload.includes("COUPON")) {
      let curation = new Curation(this.user, this.webhookEvent);
      response = curation.handlePayload(payload);
    } else if (payload.includes("CARE")) {
      let care = new Care(this.user, this.webhookEvent);
      response = care.handlePayload(payload);
    } else if (payload.includes("ORDER")) {
      response = Order.handlePayload(payload);
    } else if (payload.includes("CSAT")) {
      response = Survey.handlePayload(payload);
    } else {
      response = {
        text: `This is a default postback message for payload: ${payload}!`
      };
    }

    return response;
  }

  handlePrivateReply(type, object_id) {
    // NOTE: For production, private replies must be sent by a human agent.
    // This code is for illustrative purposes only.

    let requestBody = {
      recipient: {
        [type]: object_id
      },
      message: Response.genText(i18n.__("private_reply.post")),
      tag: "HUMAN_AGENT"
    };

    GraphApi.callSendApi(requestBody);
  }

  sendMessage(response, delay = 0) {
    // Check if there is delay in the response
    if ("delay" in response) {
      delay = response["delay"];
      delete response["delay"];
    }

    // Construct the message body
    let requestBody = {
      recipient: {
        id: this.user.igsid
      },
      message: response
    };

    setTimeout(() => GraphApi.callSendApi(requestBody), delay);
  }
};
