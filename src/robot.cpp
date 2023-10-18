#include "robot.h"
#include "lemlib/chassis/chassis.hpp"
#include "main.h"
#include "okapi/impl/device/controller.hpp"
#include "okapi/impl/device/motor/motor.hpp"
#include "okapi/impl/device/opticalSensor.hpp"
#include "okapi/impl/device/rotarysensor/rotationSensor.hpp"
#include "pros/adi.hpp"

// ~~~~~~~~~~~~~~~~~~~~~~~~~
//   Device Constructors
// ~~~~~~~~~~~~~~~~~~~~~~~~~
okapi::Controller Robot::Controller(okapi::ControllerId::master);
pros::IMU Robot::Inertial(21);
pros::ADIDigitalIn CatapultLimitSwitch('H');
pros::ADIDigitalOut Robot::ExpansionPiston('F');
pros::Motor Robot::_LeftDriveA(13,
                               Robot::Dimensions::Drivetrain::MOTOR_CARTRIDGE,
                               true);
pros::Motor Robot::_LeftDriveB(11,
                               Robot::Dimensions::Drivetrain::MOTOR_CARTRIDGE,
                               true);
pros::Motor Robot::_LeftDriveC(12,
                               Robot::Dimensions::Drivetrain::MOTOR_CARTRIDGE,
                               false);
pros::MotorGroup Robot::LeftDrive({
    Robot::_LeftDriveA,
    Robot::_LeftDriveB,
    Robot::_LeftDriveC,
});
pros::Motor Robot::_RightDriveA(18,
                                Robot::Dimensions::Drivetrain::MOTOR_CARTRIDGE,
                                false);
pros::Motor Robot::_RightDriveB(20,
                                Robot::Dimensions::Drivetrain::MOTOR_CARTRIDGE,
                                false);
pros::Motor Robot::_RightDriveC(19,
                                Robot::Dimensions::Drivetrain::MOTOR_CARTRIDGE,
                                true);
pros::MotorGroup Robot::RightDrive({
    Robot::_RightDriveA,
    Robot::_RightDriveB,
    Robot::_RightDriveC,
});
pros::Rotation Robot::LeftDriveRotation(4, true);
pros::Rotation Robot::HorizontalRotation(5, false);
pros::Rotation Robot::RightDriveRotation(6, false);
okapi::OpticalSensor Robot::RollerSensor(9);
pros::ADIDigitalOut Robot::CatapultPistonBooster('E');
okapi::Motor Robot::_IntakeA(2, false, okapi::Motor::gearset::red,
                             okapi::Motor::encoderUnits::degrees);
okapi::Motor Robot::_IntakeB(3, true, okapi::Motor::gearset::red,
                             okapi::Motor::encoderUnits::degrees);
okapi::MotorGroup Robot::Intake({Robot::_IntakeA, Robot::_IntakeB});

