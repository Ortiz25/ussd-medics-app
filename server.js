import * as dotenv from "dotenv";
dotenv.config();
import express from "express";
import bodyParser from "body-parser";
import moment from "moment";
import UssdMenu from "ussd-builder";
import {
  getDoctors,
  recordAppointment,
  sendSms,
  insertUser,
  getUserId,
  getDoctorType,
  getDoctorId,
} from "./util/helpers.js";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

let response = "";
let menu = new UssdMenu();

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

async function geocodeLocation(location) {
  try {
    const url = `https://api.opencagedata.com/geocode/v1/json?key=${opencageApiKey}&q=${location}`;
    const response = await fetch(url);

    console.log(response);
    // requests.get(url, (error, response, body) => {
    //   if (!error && response.statusCode === 200) {
    //     const data = JSON.parse(body);

    //     if ("results" in data && data.results.length > 0) {
    //       const locationData = data.results[0];
    //       const latitude = locationData.geometry.lat;
    //       const longitude = locationData.geometry.lng;
    //       const formattedAddress = locationData.formatted_address;
    //       return { latitude, longitude, formattedAddress };
    //     } else {
    //       // Default location for Kenya (coordinates near the center of Kenya)
    //       const kenyaLatitude = 1.2921;
    //       const kenyaLongitude = 36.8219;
    //       return {
    //         latitude: kenyaLatitude,
    //         longitude: kenyaLongitude,
    //         formattedAddress: "Kenya",
    //       };
    //     }
    //   } else {
    //     console.error("Error geocoding location:", error);
    //     return null;
    //   }
    // });
  } catch (error) {
    console.log(error);
  }
}

// USSD Menu
app.post("/ussd", async (req, res) => {
  // Read the variables sent via POST from our API
  const { sessionId, serviceCode, phoneNumber, text } = req.body;

  const doctorsIndexArray = [];
  const doctorsArray = [];
  let doctors;
  let specialist;

  // Define menu states
  menu.startState({
    run: () => {
      // use menu.con() to send response without terminating session
      menu.con(
        "Welcome to FindSpecialist USSD App " + "\n1. Press 1 to start:"
      );
    },
    // next object links to next state based on user input
    next: {
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
        menu.con("Enter your number (e.g +254712345678):");
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
      menu.session.set("location", location);

      let string1 = `Select the type of specialist you need:`;
      let string2 = "";
      specialistType.forEach((specialist, index) => {
        string2 += `
      ${index + 1}. ${specialist}
     `;
      });
      menu.con(string1.concat(" ", string2));
    },
    next: {
      "*[1-6]": "registration.specialist",
    },
  });
  menu.state("registration.specialist", {
    run: async () => {
      let specialist;
      let docIndex = menu.val;
      const doctors = await getDoctors();
      doctors.forEach((doctor, idx) => {
        doctorsArray.push({ index: `${idx + 1}`, name: doctor.name });
      });
      specialist = doctorsArray.filter(
        (doctor) => doctor.index === docIndex
      )[0];

      await menu.session.set("specialist", specialist?.name);
      const name = await menu.session.get("name");
      const age = await menu.session.get("age");
      const number = await menu.session.get("number");
      const location = await menu.session.get("location");
      await insertUser(name, age, number, location);
      menu.con("Please enter the date for the appointment (YYYY-MM-DD):");
    },
    next: {
      "*\\d+": "appointment.date",
    },
  });
  menu.state("appointment.date", {
    run: async () => {
      let date = menu.val;
      await menu.session.set("date", date);
      menu.con("Please enter the time for the appointment (HH:MM AM/PM):");
    },
    next: {
      "*\\d+": "appointment.time",
    },
  });

  menu.state("appointment.time", {
    run: async () => {
      let time = menu.val;
      await menu.session.set("time", time);
      const date = await menu.session.get("date");
      console.log(date, time);
      menu.con("Select 1 to confirm appointment:");
    },
    next: {
      1: "create.appointment",
    },
  });

  menu.state("create.appointment", {
    run: async () => {
      const date = await menu.session.get("date");
      const time = await menu.session.get("time");
      const timeObject = moment(time, "hh:mm").format("HH:mm");
      const specialist = await menu.session.get("specialist");
      const name = await menu.session.get("name");
      const userId = await getUserId(name);
      const doctorId = await getDoctorId(specialist);
      const sms_message = `Appointment scheduled with ${specialist} on ${date} at ${time}.`;
      await sendSms(phoneNumber, sms_message);
      await recordAppointment(userId, doctorId, date, timeObject);
      menu.end(`Your appointment has been scheduled.
                      An appointment confirmation SMS has been sent to your phone.`);
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
const PORT = 2000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
