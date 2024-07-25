import * as dotenv from "dotenv";
dotenv.config();
import express from "express";
import bodyParser from "body-parser";
import moment from "moment";
import UssdMenu from "ussd-builder";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import {
  getDoctors,
  recordAppointment,
  sendSms,
  insertUser,
  getUserId,
  getDoctorType,
  getDoctorId,
  getDoctorsNames,
  checkUserExist,
  recordTeleppointment,
  getGoogleAppointments,
  convertTo24Hour,
} from "./util/helpers.js";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
let tokens = null;

///////////////////Google Calender API Setup //////////////////////////////

const REDIRECT_URI = "http://localhost:2000/oauth2callback";

const oAuth2Client = new OAuth2Client(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  REDIRECT_URI
);

// Generate a URL for the user to authorize the app
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/calendar"],
});

// Exchange authorization code for access token
async function getAccessToken(code) {
  const { tokens } = await oAuth2Client.getToken(code);
  return tokens.access_token;
}

/////////////////////////////////////////////////////////////////////////////

let response = "";
let menu = new UssdMenu();
let specialistNumber;
let doctorNumber;
let string1 = `Select a Doctor:`;
let string2 = "";
// opencage Geo Tag

const opencageApiKey = "e5ba777eaffa4d52be886c3dee823f10";

// Sessions
let sessions = {};

menu.sessionConfig({
  start: (sessionId, callback) => {
    // initialize current session if it doesn't exist
    // this is called by menu.run()
    if (!(sessionId in sessions)) sessions[sessionId] = {};
    callback();
  },
  end: (sessionId, callback) => {
    // clear current session
    // this is called by menu.end()
    delete sessions[sessionId];
    callback();
  },
  set: (sessionId, key, value, callback) => {
    // store key-value pair in current session
    sessions[sessionId][key] = value;
    callback();
  },
  get: (sessionId, key, callback) => {
    // retrieve value by key in current session
    let value = sessions[sessionId][key];
    callback(null, value);
  },
});

////////////////////USSD Menu//////////////////////////////////////////
app.post("/ussd", async (req, res) => {
  // Read the variables sent via POST from our API
  const { sessionId, serviceCode, phoneNumber, text } = req.body;
  const userExists = await checkUserExist(phoneNumber);
  const doctorsIndexArray = [];
  const doctorsArray = [];
  let doctors;
  let specialist;
  let setAppoint;
  const timeSlots = [
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "01:00 PM",
    "02:00 PM",
    "03:00 PM ",
  ];

  // Define menu states
  menu.startState({
    run: () => {
      menu.con(
        "Welcome to Medics USSD App:" +
          "\n1. Press 1 to start:" +
          "\n0. Press 0 to Exit:"
      );
    },

    next: {
      0: "Exit",
      1: "start",
    },
  });

  menu.state("start", {
    run: () => {
      menu.con("Enter your name:");
    },
    next: {
      "*[a-zA-Z]+": "registration.name",
    },
  });
  menu.state("registration.name", {
    run: function () {
      let name = menu.val;
      menu.session.set("name", name).then(() => {
        menu.con("Enter your Age");
      });
    },
    next: {
      "*^[1-9]$|^[1-9][0-9]$|^(100)$": "registration.age",
    },
  });

  menu.state("registration.age", {
    run: function () {
      let age = menu.val;
      menu.session.set("age", age).then(() => {
        menu.con("Enter your number (e.g 0712345678):");
      });
    },
    next: {
      "*\\d{10}": "registration.number",
    },
  });
  menu.state("registration.number", {
    run: () => {
      let number = menu.val;
      menu.session.set("number", number).then(() => {
        menu.con("Enter your Location (e.g Nairobi):");
      });
    },
    next: {
      "*[a-zA-Z]+": "registration.location",
    },
  });

  menu.state("registration.location", {
    run: async () => {
      let location = menu.val;
      const specialistType = await getDoctorType();
      if (location.length > 2) {
        menu.session.set("location", location);
      }
      let unique = [...new Set(specialistType)];
      let string1 = `Select specialist you need:`;
      let string2 = "";
      unique.forEach((specialist, index) => {
        string2 += `
      ${index + 1}. ${specialist}
     `;
      });
      specialistNumber = `*[1-${unique.length}]`;

      menu.con(string1.concat(" ", string2));
    },
    next: {
      [specialistNumber]: "registration.specialist",
    },
  });
  menu.state("registration.specialist", {
    run: async () => {
      let docIndex = menu.val;
      // console.log("Index", docIndex);
      const doctors = await getDoctors();
      const specialistType = await getDoctorType();
      // console.log(doctors, specialistType);
      doctors.forEach((doctor, idx) => {
        doctorsArray.push({ index: `${idx + 1}`, name: doctor.name });
      });
      let unique = [...new Set(specialistType)];
      specialist = unique.at(docIndex - 1);
      if (specialist) {
        const docNames = await getDoctorsNames(specialist);
        await menu.session.set("docNamesArray", docNames);
        //console.log("Docnames", docNames);
        doctorNumber = `*[1-${docNames?.length}]`;
        await menu.session.set("specialist", specialist?.name);

        if (string2.length === 0) {
          docNames.forEach((specialist, index) => {
            string2 += `
          ${index + 1}. ${specialist}
         `;
          });
        }
      }
      menu.con(string1.concat(" ", string2));
    },
    next: {
      [doctorNumber]: "appointment.doctor",
    },
  });

  menu.state("appointment.doctor", {
    run: async () => {
      let docIndex = menu.val;
      console.log("doc index", docIndex);
      const doc = await menu.session.get("Doctor");
      console.log("doc", doc);
      if (!doc) {
        const docNamesArray = await menu.session.get("docNamesArray");
        console.log("Array", docNamesArray);
        const doctor = docNamesArray.at(docIndex - 1);
        console.log("Doctor", doctor);
        await menu.session.set("Doctor", doctor);
      }

      menu.con(
        "Please enter the Appointment type:" +
          "\n 1.Press 1 for Physical appointment" +
          "\n 2.Press 2 for Remote(Video appointment)"
      );
    },
    next: {
      1: "physical",
      2: "remote",
    },
  });

  menu.state("physical", {
    run: async () => {
      const daktari = await menu.session.get("Doctor");
      await menu.session.set("appointmentType", "physical");
      menu.con(
        "Please enter the Date for the Physical appointment (YYYY-MM-DD):"
      );
    },
    next: {
      "*\\d+": "appointment.date",
    },
  });

  menu.state("remote", {
    run: async () => {
      const daktari = await menu.session.get("Doctor");
      //console.log("Daktari", daktari);
      await menu.session.set("appointmentType", "remote");
      menu.con(
        "Please enter the Date for the Remote appointment (YYYY-MM-DD):"
      );
    },
    next: {
      "*\\d+": "appointment.date",
    },
  });

  menu.state("appointment.date", {
    run: async () => {
      let date = menu.val;
      const appointments = await getGoogleAppointments(date);
      await menu.session.set("date", date);
      const timesToRemove = appointments.map((appointment) =>
        appointment.dataValues.start_time.slice(0, 5)
      );

      // Filter out the times
      const filteredTimeSlots = timeSlots.filter((slot) => {
        const slot24h = convertTo24Hour(slot.trim()); // Convert to 24-hour format and trim whitespace
        return !timesToRemove.includes(slot24h);
      });

      await menu.session.set("slots", filteredTimeSlots);

      const timeSlotsString = filteredTimeSlots
        .map((slot, index) => `${index + 1}. ${slot}`)
        .join("\n");

      menu.con(`Please select an Appointment time slot:\n${timeSlotsString}`);
    },
    next: {
      "*[1-6]": "appointment.time",
    },
  });

  menu.state("appointment.time", {
    run: async () => {
      let time = menu.val;
      const slots = await menu.session.get("slots");
      // console.log("Timeslot", slots[time - 1]);
      await menu.session.set("time", slots[time - 1]);
      // const date = await menu.session.get("date");
      // console.log(date, time);
      const age = await menu.session.get("age");
      const name = await menu.session.get("name");
      const number = await menu.session.get("number");
      const location = await menu.session.get("location");
      await insertUser(name, age, number, location);

      menu.con("Select 1 to confirm appointment:");
    },
    next: {
      1: "create.appointment",
    },
  });

  menu.state("create.appointment", {
    run: async () => {
      const appointmentType = await menu.session.get("appointmentType");
      const date = await menu.session.get("date");
      const time = await menu.session.get("time");
      const specialist = await menu.session.get("Doctor");
      const name = await menu.session.get("name");

      const doctorId = await getDoctorId(specialist);

      const number = await menu.session.get("number");
      //console.log("Number", number);
      const userId = await checkUserExist(number);
      //await insertUser(name, age, number, location);
      const sms_message = `Appointment scheduled with ${specialist} on ${date} at ${time}.`;
      await sendSms(phoneNumber, sms_message);
      //console.log("User ID", userId);
      if (appointmentType === "physical") {
        await recordAppointment(userId, doctorId, date, time);
      } else {
        await recordTeleppointment(userId, doctorId, date, time);
      }
      //console.log(specialist, doctorId, name, date, time);
      menu.end(`Your appointment has been scheduled.
                      An appointment confirmation SMS has been sent to your phone.`);
    },
  });

  menu.state("Exit", {
    run: async () => {
      console.log(phoneNumber);
      menu.end(`BYE BYE`);
    },
  });
  // Send the response back to the API
  menu.run(req.body, (ussdResult) => {
    res.send(ussdResult);
  });
});

app.get("/", async (req, res) => {
  res.send("Hello Word");
});

// Start the server
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
