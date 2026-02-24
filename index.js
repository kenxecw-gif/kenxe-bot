const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// 🔐 PASTE YOUR VALUES HERE
const TOKEN = "EAALTvXC5H3gBQZBPs0KKiXtKHZCeJffXzDlwyfSC25ZCquZCEIQ76FLbN0zYr5lA5M86aFoAR8LIZCEK70p1QbsuqlrFiohq0XVJvWtmvIlzLnHZAoZCgiORSdRvExTmbeDcOEmfZA1J17RGfxSV7SfJoeFazINKk1E6ErCsZBGUN3KCGrglPnHzVJhFtkHjZA1547NAZDZD";
const PHONE_NUMBER_ID = "932688436604454";
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

    // STEP 3 – Ask All Details in One Message
else if (userSessions[from].step === "service") {
  userSessions[from].service = text;

  reply = `Please send your booking details in this format:

Name:
Car Name:
Date & Time:
Live Location:

Example:

Name: Rocky
Car Name: Swift
Date & Time: 25/02/2026 - 10:30 AM
Live Location: Anna Nagar`;

  userSessions[from].step = "details";
}

// STEP 4 – Save Full Details
else if (userSessions[from].step === "details") {
  userSessions[from].details = text;

  reply = `✅ *Booking Received!*

🧼 Service: ${userSessions[from].service}

📋 Details:
${text}

Our Kenxe team will contact you shortly 🚗✨
"Your Time, Your Place – Our Care"`;

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





