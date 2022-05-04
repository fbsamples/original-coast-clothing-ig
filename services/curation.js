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

// Imports dependencies
const Response = require("./response"),
  config = require("./config"),
  i18n = require("../i18n.config");

module.exports = class Curation {
  constructor(user, webhookEvent) {
    this.user = user;
    this.webhookEvent = webhookEvent;
  }

  handlePayload(payload) {
    let response;

    switch (payload) {
      case "CURATION":
        response = Response.genQuickReply(
          i18n.__("curation.prompt", {
            userName: this.user.name
          }),
          [
            {
              title: i18n.__("curation.work"),
              payload: "CURATION_WORK"
            },
            {
              title: i18n.__("curation.dinner"),
              payload: "CURATION_DINNER"
            },
            {
              title: i18n.__("curation.party"),
              payload: "CURATION_PARTY"
            }
          ]
        );
        break;
      case "CURATION_ABOUT":
        response = Response.genText(i18n.__("curation.product_information"));
        break;
      case "CURATION_WORK":
      case "CURATION_DINNER":
      case "CURATION_PARTY":
        response = this.genCurationResponse(payload);
        break;
    }

    return response;
  }

  genCurationResponse(payload) {
    const occasion = payload.split("_")[1].toLowerCase();
    const outfit = `neutral-${occasion}`;

    // NOTE: Products may also be displayed with Product Templates.
    // See the Instagram API Developer Documentation for more information.

    let buttons = [
      {
        type: "web_url",
        title: i18n.__("curation.shop"),
        url: `${config.shopUrl}/products/${outfit}`
      },
      {
        type: "postback",
        title: i18n.__("curation.sales"),
        payload: "CARE_SALES"
      },
      {
        type: "postback",
        title: i18n.__("curation.about"),
        payload: "CURATION_ABOUT"
      }
    ];

    let response = Response.genGenericTemplate(
      `${config.appUrl}/styles/${outfit}.jpg`,
      i18n.__("curation.title"),
      i18n.__("curation.subtitle"),
      buttons
    );

    return response;
  }
};
