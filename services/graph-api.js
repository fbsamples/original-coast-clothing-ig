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

// Import dependencies
const request = require("request"),
  camelCase = require("camelcase"),
  config = require("./config");

module.exports = class GraphAPi {
  static callSendAPI(requestBody) {
    // Send the HTTP request to the Graph API
    request(
      {
        uri: `${config.mPlatfom}/me/messages`,
        qs: {
          access_token: config.pageAccesToken
        },
        method: "POST",
        json: requestBody
      },
      error => {
        if (error) {
          console.error("Unable to send message:", error);
        }
      }
    );
  }

  static async getUserProfile(senderIgsid) {
    const userProfile = await this.callUserProfileAPI(senderIgsid);

    for (const key in userProfile) {
      const camelizedKey = camelCase(key);
      const value = userProfile[key];
      delete userProfile[key];
      userProfile[camelizedKey] = value;
    }

    return userProfile;
  }

  static callUserProfileAPI(senderIgsid) {
    return new Promise(function(resolve, reject) {
      let body = [];

      // Send the HTTP request to the Graph API
      // See: https://developers.facebook.com/docs/messenger-platform/instagram/features/user-profile
      request({
        uri: `${config.mPlatfom}/${senderIgsid}`,
        qs: {
          access_token: config.pageAccesToken,
          fields: "name,profile_pic"
        },
        method: "GET"
      })
        .on("response", function(response) {
          if (response.statusCode !== 200) {
            console.error(
              `Graph API call failed with status code ${response.statusCode}. URI was: ${response.request.uri.href}`
            );
            reject(Error(response.statusCode));
          }
        })
        .on("data", function(chunk) {
          body.push(chunk);
        })
        .on("error", function(error) {
          console.error("Unable to get user profile:", error);
          reject(Error("Network Error"));
        })
        .on("end", () => {
          body = Buffer.concat(body).toString();
          resolve(JSON.parse(body));
        });
    });
  }

  static setIcebreakers(iceBreakers) {
    request({
      uri: `${config.mPlatfom}/me/messenger_profile`,
      qs: {
        access_token: config.pageAccesToken
      },
      method: "POST",
      json: {
        platform: "instagram",
        ice_breakers: iceBreakers
      }
    })
      .on("response", function(response) {
        if (response.statusCode !== 200) {
          console.error(
            `Icebreakers API call failed with status code ${response.statusCode}.\n` +
              `URI was:\n${response.request.uri.href}.\n` +
              `POST body was:\n${response.request.body}`
          );
          return;
        }
        console.log(`Icebreakers have been set.`);
      })
      .on("error", function(error) {
        console.log(`Error setting ice breakers`);
        console.dir(error);
      });
  }

  static setPageSubscriptions() {
    request({
      uri: `${config.mPlatfom}/${config.pageId}/subscribed_apps`,
      qs: {
        access_token: config.pageAccesToken,
        subscribed_fields: "feed"
      },
      method: "POST"
    })
      .on("response", function(response) {
        if (response.statusCode !== 200) {
          console.error(
            `Page subscriptions API call failed with status code ${response.statusCode}.\n` +
              `URI was:\n${response.request.uri.href}.\n` +
              `POST body was:\n${response.request.body}`
          );
          return;
        }
        console.log(`Page subscriptions have been set.`);
      })
      .on("error", function(error) {
        console.log(`Error setting page subscriptions`);
        console.dir(error);
      });
  }
};
