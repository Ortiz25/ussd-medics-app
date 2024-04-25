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
