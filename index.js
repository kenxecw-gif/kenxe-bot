const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// 🔐 PASTE YOUR VALUES HERE
const TOKEN = "EAALTvXC5H3gBQzqDsDOCSgN7AMu1UuzLUdLrcFZARER31b1qd8x1gZAj0volQzhx5nBngPFvZBdcVrVrApcSZB1YHU6WIi1PNKHOL1t4ajBi5KElthy6DI1L00mCWdK2yRPK8CFotzJL3N8JSJTXZBKFczjEfv3oZCLJTcbtS4eZAkAZB6j8Fg9pbZBI7bXBMQhQ86SdVUD1HXhYMZCrDDst3ODj6k2PKXpUWM89I2ybfZCJY23fM35gpQtImqvKZBy5jQfVH2Uadatk27SXbZCYLFjBPXSiZA";
const PHONE_NUMBER_ID = "PASTE_YOUR_PHONE_NUMBER_ID_HERE";
const VERIFY_TOKEN = "12345";   // Make sure this matches Meta webhook

// Store user sessions
let userSessions = {};

// 🔹 WEBHOOK VERIFICATION
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified!");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// 🔹 MAIN BOT LOGIC
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object) {
    const message =
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const text = message.text?.body;

      if (!userSessions[from]) {
        userSessions[from] = { step: "start" };
      }

      let reply = "";

      // STEP 1 – Show Menu
      if (userSessions[from].step === "start") {
        reply = "Welcome to *Kenxe* 🚗✨\n\"Your Time, Your Place – Our Care\"\n\n1️⃣ One Time Wash\n2️⃣ Subscription Plans\n\nReply with number.";
        userSessions[from].step = "menu";
      }

      // STEP 2 – Choose Type
      else if (userSessions[from].step === "menu") {
        if (text === "1") {
          reply = "Choose Service:\n1️⃣ Stranded – ₹399\n2️⃣ Premium – ₹499\n3️⃣ Diamond – ₹599";
          userSessions[from].type = "One Time";
          userSessions[from].step = "service";
        } else if (text === "2") {
          reply = "Choose Plan:\n1️⃣ Silver – ₹1199\n2️⃣ Gold – ₹2199\n3️⃣ Platinum – ₹3099";
          userSessions[from].type = "Subscription";
          userSessions[from].step = "service";
        } else {
          reply = "Please reply with 1 or 2.";
        }
      }

      // STEP 3 – Save Service
      else if (userSessions[from].step === "service") {
        userSessions[from].service = text;
        reply = "Please enter your Name:";
        userSessions[from].step = "name";
      }

      // STEP 4 – Save Name
      else if (userSessions[from].step === "name") {
        userSessions[from].name = text;
        reply = "Enter your Location:";
        userSessions[from].step = "location";
      }

      // STEP 5 – Save Location
      else if (userSessions[from].step === "location") {
        userSessions[from].location = text;
        reply = "Enter Preferred Date (DD/MM/YYYY):";
        userSessions[from].step = "date";
      }

      // STEP 6 – Save Date
      else if (userSessions[from].step === "date") {
        userSessions[from].date = text;
        reply = "Enter Preferred Time:";
        userSessions[from].step = "time";
      }

      // STEP 7 – Confirm Booking
      else if (userSessions[from].step === "time") {
        userSessions[from].time = text;

        reply = `✅ *Booking Confirmed!*\n\nName: ${userSessions[from].name}\nType: ${userSessions[from].type}\nService: ${userSessions[from].service}\nLocation: ${userSessions[from].location}\nDate: ${userSessions[from].date}\nTime: ${userSessions[from].time}\n\nOur team will contact you soon 🚗✨`;

        userSessions[from].step = "done";
      }

      await axios.post(
        `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply }
        },
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": "application/json"
          }
        }
      );
    }
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
