#pragma once
#include "lemlib/chassis/chassis.hpp"
#include "lemlib/chassis/trackingWheel.hpp"
#include "lemlib/pose.hpp"
#include "main.h"
#include "okapi/impl/device/controller.hpp"
#include "okapi/impl/device/motor/motor.hpp"
#include "okapi/impl/device/motor/motorGroup.hpp"
#include "okapi/impl/device/opticalSensor.hpp"
#include "okapi/impl/device/rotarysensor/IMU.hpp"
#include "okapi/impl/device/rotarysensor/rotationSensor.hpp"
#include "pros/adi.hpp"

class Robot {
public:
  class Dimensions {
  public:
    class Drivetrain {
    public:
      static constexpr float WHEEL_DIAMETER = 3.25 / 2;
      /**
       * @brief horizontal length between left and right wheels
       * @see
       * https://lemlib.github.io/LemLib/md_docs_tutorials_2_setting_up_the_chassis.html#autotoc_md13
       */
      static constexpr float TRACK = 15;
      /**
       * @brief vertical length between front and back wheels
       * @see
       * https://lemlib.github.io/LemLib/md_docs_tutorials_2_setting_up_the_chassis.html#autotoc_md13
       */
      static constexpr float WHEEL_BASE = 15;
      /**
       * @brief 2 turns of wheel to 3 turns of motor
       */
      static constexpr float GEAR_RATIO = 2.0F / 3.0F;
      /**
       * @brief drive motor cartridges
       */
      static constexpr pros::motor_gearset_e_t MOTOR_CARTRIDGE =
          pros::motor_gearset_e_t::E_MOTOR_GEAR_600;
      /**
       * @brief rpm of the drive wheels
       */
      static constexpr float WHEEL_RPM =
          GEAR_RATIO *
          (MOTOR_CARTRIDGE == 0
               ? 100
               : (MOTOR_CARTRIDGE == 1 ? 200
                                       : (MOTOR_CARTRIDGE == 3 ? 600 : 0)));
    };
    class Odometry {
    public:
      /**
       * @brief Dimension for the Left Encoder Wheel
       */
      class Left {
      public:
        static constexpr float DIAMETER = 2.75;
        /**
         * @brief Horizontal offset from tracking center
         * @see
         * https://lemlib.github.io/LemLib/md_docs_tutorials_2_setting_up_the_chassis.html#autotoc_md14
         */
        static constexpr float OFFSET = 0;
      };
      /**
       * @brief Dimension for the Right Encoder Wheel
       */
      class Right {
      public:
        static constexpr float DIAMETER = 2.75;
        /**
         * @brief Horizontal offset from tracking center
         * @see
         * https://lemlib.github.io/LemLib/md_docs_tutorials_2_setting_up_the_chassis.html#autotoc_md14
         */
        static constexpr float OFFSET = 0;
      };
      /**
       * @brief Dimension for the Horizontal Encoder Wheel
       */
      class Horizontal {
      public:
        static constexpr float DIAMETER = 2.75;
        /**
         * @brief Vertical offset from tracking center
         * @see
         * https://lemlib.github.io/LemLib/md_docs_tutorials_2_setting_up_the_chassis.html#autotoc_md14
         */
        static constexpr float OFFSET = 0;
      };
    };
  };

  static okapi::Controller Controller;
  static pros::MotorGroup LeftDrive;
  static pros::Motor _LeftDriveA;
  static pros::Motor _LeftDriveB;
  static pros::Motor _LeftDriveC;
  static pros::MotorGroup RightDrive;
  static pros::Motor _RightDriveA;
  static pros::Motor _RightDriveB;
  static pros::Motor _RightDriveC;
  static okapi::MotorGroup Intake;
  static okapi::Motor _IntakeA;
  static okapi::Motor _IntakeB;
  static pros::IMU Inertial;
  static okapi::OpticalSensor RollerSensor;
  static pros::ADIDigitalIn CatapultLimitSwitch;
  static pros::Rotation LeftDriveRotation;
  static pros::Rotation RightDriveRotation;
  static pros::Rotation HorizontalRotation;
  static pros::ADIDigitalOut CatapultPistonBooster;
  static pros::ADIDigitalOut ExpansionPiston;

// private:
  class Odometry {
  private:
    static lemlib::TrackingWheel left;
    static lemlib::TrackingWheel right;
    static lemlib::TrackingWheel horizontal;

  public:
    static lemlib::OdomSensors_t sensors;
  };

  class PID {
  public:
    /**
     * @brief forward/backward PID
     */
    static lemlib::ChassisController_t lateral;
    /**
     * @brief turning PID
     */
    static lemlib::ChassisController_t angular;
  };
  static lemlib::Drivetrain_t drivetrain;

public:
  static lemlib::Chassis Chassis;

  class Actions {
  public:
    static void roller();
    static void shoot();
    static void pistonShoot();
    static void intake();
    static void stopIntake();
    static void expand();
  };
};