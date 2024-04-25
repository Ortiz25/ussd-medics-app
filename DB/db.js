import * as dotenv from "dotenv";
dotenv.config();
import { Sequelize, DataTypes } from "sequelize";

// mysql Database connection
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.MYSQLDB_HOST,
    dialect: "mysql",
    port: process.env.PORT,
  }
);

// Define models
export const User = sequelize.define(
  "User",
  {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: DataTypes.STRING,
    age: DataTypes.STRING,
    phone_number: DataTypes.STRING,
    location: DataTypes.STRING,
  },
  {
    timestamps: false,
  }
);

export const Doctor = sequelize.define(
  "Doctor",
  {
    doctor_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: DataTypes.STRING,
    contact_info: {
      type: DataTypes.STRING,
      unique: true,
    },
    type: DataTypes.STRING,
    location: DataTypes.STRING,
  },
  {
    timestamps: false,
  }
);

export const Appointment = sequelize.define(
  "Appointment",
  {
    appointment_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: DataTypes.INTEGER,
    doctor_id: DataTypes.INTEGER,
    date: DataTypes.DATE,
    time: DataTypes.TIME,
    status: DataTypes.STRING,
  },
  {
    timestamps: false,
  }
);

// Define associations
Appointment.belongsTo(User, { foreignKey: "user_id", as: "User" });
Appointment.belongsTo(Doctor, { foreignKey: "doctor_id", as: "Doctor" });
User.hasMany(Appointment, { foreignKey: "user_id" });
Doctor.hasMany(Appointment, { foreignKey: "doctor_id" });
