import * as dotenv from "dotenv";
dotenv.config();
import { User, Appointment, Doctor } from "../DB/db.js";
import Africastalking from "africastalking";

// Africa is talking
const credentials = {
  apiKey: process.env.AFRICASTALKING_TOKEN,
  username: process.env.AFRICASTALKING_USERNAME,
};

const sms = Africastalking(credentials).SMS;

// insert user into DB
export async function insertUser(name, age, phoneNumber, location) {
  const newUser = {
    name: name,
    age: age,
    phone_number: phoneNumber,
    location: location,
  };
  try {
    await User.create(newUser);
  } catch (e) {
    console.error("Error inserting data:", e);
  }
}

//Get User By ID
export async function getUserId(name) {
  try {
    const user = await User.findOne({
      attributes: ["user_id"],
      where: { name: name },
    });
    return user.user_id;
  } catch (e) {
    console.error("Error getting user ID:", e);
  }
}

//get Doctots name
export async function getDoctorsNames(type) {
  try {
    const doctorsArray = [];
    const doctors = await Doctor.findAll({
      attributes: ["name"],
      where: { type: type },
    });

    doctors.forEach((doctor) => {
      doctorsArray.push(doctor.name);
    });
    return doctorsArray;
  } catch (e) {
    console.error("Error getting user ID:", e);
  }
}

//get Doctor by ID
export async function getDoctorId(name) {
  try {
    const doctor = await Doctor.findOne({
      attributes: ["doctor_id"],
      where: { name: name },
    });
    return doctor.doctor_id;
  } catch (e) {
    console.error("Error getting user ID:", e);
  }
}

// get Doctor types
export async function getDoctorType() {
  try {
    const doctorsArray = [];
    const doctors = await Doctor.findAll({
      attributes: ["type"],
    });
    doctors.forEach((doctor) => {
      doctorsArray.push(doctor.type);
    });
    return doctorsArray;
  } catch (e) {
    console.error("Error getting user ID:", e);
  }
}

// Get Doctors from DB
export async function getDoctors() {
  try {
    const doctorsArray = [];
    const doctors = await Doctor.findAll({
      attributes: ["doctor_id", "name"],
    });
    doctors.forEach((doctor) => {
      doctorsArray.push({ doctor_id: doctor.doctor_id, name: doctor.name });
    });
    return doctorsArray;
  } catch (error) {
    console.log(error);
  }
}

// Record appointment in DB
export async function recordAppointment(userId, doctorId, date, time) {
  try {
    await Appointment.create({
      user_id: userId,
      doctor_id: doctorId,
      date: date,
      time: time,
      status: "Scheduled",
    });
  } catch (e) {
    console.error("Error inserting data:", e);
  }
}

export async function sendSms(phoneNumber, message) {
  const options = {
    to: [phoneNumber],
    message: message,
  };
  async function sendSMS() {
    try {
      const result = await sms.send(options);
      console.log(result);
    } catch (err) {
      console.error(err);
    }
  }
  sendSMS();
}

// async function geocodeLocation(location) {
//   try {
//     const url = `https://api.opencagedata.com/geocode/v1/json?key=${opencageApiKey}&q=${location}`;
//     const response = await fetch(url);

//     console.log(response);
//     // requests.get(url, (error, response, body) => {
//     //   if (!error && response.statusCode === 200) {
//     //     const data = JSON.parse(body);

//     //     if ("results" in data && data.results.length > 0) {
//     //       const locationData = data.results[0];
//     //       const latitude = locationData.geometry.lat;
//     //       const longitude = locationData.geometry.lng;
//     //       const formattedAddress = locationData.formatted_address;
//     //       return { latitude, longitude, formattedAddress };
//     //     } else {
//     //       // Default location for Kenya (coordinates near the center of Kenya)
//     //       const kenyaLatitude = 1.2921;
//     //       const kenyaLongitude = 36.8219;
//     //       return {
//     //         latitude: kenyaLatitude,
//     //         longitude: kenyaLongitude,
//     //         formattedAddress: "Kenya",
//     //       };
//     //     }
//     //   } else {
//     //     console.error("Error geocoding location:", error);
//     //     return null;
//     //   }
//     // });
//   } catch (error) {
//     console.log(error);
//   }
// }
