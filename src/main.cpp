#include "main.h"
#include "auton.h"
#include "okapi/impl/device/controllerUtil.hpp"
#include "robot.h"

/**
 * A callback function for LLEMU's center button.
 *
 * When this callback is fired, it will toggle line 2 of the LCD text between
 * "I was pressed!" and nothing.
 */
void on_center_button() {
  static bool pressed = false;
  pressed = !pressed;
  if (pressed) {
    pros::lcd::set_text(2, "I was pressed!");
  } else {
    pros::lcd::clear_line(2);
  }
}

void screen() {
  // loop forever
}

/**
 * Runs initialization code. This occurs as soon as the program is started.
 *
 * All other competition modes are blocked by initialize; it is recommended
 * to keep execution time for this mode under a few seconds.
 */
void initialize() {
  // ~~~~~~~~~~~~~~~~~~~~~~~~~
  //         Odometry
  // ~~~~~~~~~~~~~~~~~~~~~~~~~
  lemlib::TrackingWheel left(&Robot::LeftDriveRotation,
                             Robot::Dimensions::Odometry::Left::DIAMETER,
                             Robot::Dimensions::Odometry::Left::OFFSET);
  lemlib::TrackingWheel right(&Robot::RightDriveRotation,
                              Robot::Dimensions::Odometry::Right::DIAMETER,
                              Robot::Dimensions::Odometry::Right::OFFSET);
  lemlib::TrackingWheel horizontal(
      &Robot::HorizontalRotation,
      Robot::Dimensions::Odometry::Horizontal::DIAMETER,
      Robot::Dimensions::Odometry::Horizontal::OFFSET);

  lemlib::OdomSensors_t sensors{&left, &right, &horizontal, nullptr,
                                &Robot::Inertial};

  // ~~~~~~~~~~~~~~~~~~~~~~~~~
  //           PID
  // ~~~~~~~~~~~~~~~~~~~~~~~~~

  lemlib::ChassisController_t lateral{
      8,   // kP
      30,  // kD
      1,   // smallErrorRange
      100, // smallErrorTimeout
      3,   // largeErrorRange
      500, // largeErrorTimeout
      5    // slew rate
  };
  lemlib::ChassisController_t angular{
      4,   // kP
      40,  // kD
      1,   // smallErrorRange
      100, // smallErrorTimeout
      3,   // largeErrorRange
      500, // largeErrorTimeout
      0    // slew rate
  };

  lemlib::Drivetrain_t drivetrain{&Robot::LeftDrive, &Robot::RightDrive,
                                  Robot::Dimensions::Drivetrain::TRACK,
                                  Robot::Dimensions::Drivetrain::WHEEL_DIAMETER,
                                  Robot::Dimensions::Drivetrain::WHEEL_RPM};

  lemlib::Chassis Chassis(drivetrain, lateral, angular, sensors);

  pros::lcd::initialize();
  pros::lcd::set_text(1, "Hello PROS User!");

  // pros::lcd::register_btn1_cb(on_center_button);
  Chassis.calibrate();
  Chassis.setPose(0, 0, 0, true);
  pros::Task screenTask(screen);
  while (true) {
    lemlib::Pose pose =
        Chassis.getPose(); // get the current position of the robot
    pros::lcd::print(0, "x: %f", pose.x);           // print the x position
    pros::lcd::print(1, "y: %f", pose.y);           // print the y position
    pros::lcd::print(2, "heading: %f", pose.theta); // print the heading
    pros::delay(10);
  }
}

/**
 * Runs while the robot is in the disabled state of Field Management System or
 * the VEX Competition Switch, following either autonomous or opcontrol. When
 * the robot is enabled, this task will exit.
 */
void disabled() {}

/**
 * Runs after initialize(), and before autonomous when connected to the Field
 * Management System or the VEX Competition Switch. This is intended for
 * competition-specific initialization routines, such as an autonomous selector
 * on the LCD.
 *
 * This task will exit when the robot is enabled and autonomous or opcontrol
 * starts.
 */
void competition_initialize() {}

/**
 * Runs the user autonomous code. This function will be started in its own task
 * with the default priority and stack size whenever the robot is enabled via
 * the Field Management System or the VEX Competition Switch in the autonomous
 * mode. Alternatively, this function may be called in initialize or opcontrol
 * for non-competition testing purposes.
 *
 * If the robot is disabled or communications is lost, the autonomous task
 * will be stopped. Re-enabling the robot will restart the task, not re-start it
 * from where it left off.
 */
void autonomous() { autons::leftRoller(); }

/**
 * Runs the operator control code. This function will be started in its own task
 * with the default priority and stack size whenever the robot is enabled via
 * the Field Management System or the VEX Competition Switch in the operator
 * control mode.
 *
 * If no competition control is connected, this function will run immediately
 * following initialize().
 *
 * If the robot is disabled or communications is lost, the
 * operator control task will be stopped. Re-enabling the robot will restart the
 * task, not resume it from where it left off.
 */
void opcontrol() {
  while (true) {
    // pros::lcd::print(0, "%d %d %d",
    //                  (pros::lcd::read_buttons() & LCD_BTN_LEFT) >> 2,
    //                  (pros::lcd::read_buttons() & LCD_BTN_CENTER) >> 1,
    //                  (pros::lcd::read_buttons() & LCD_BTN_RIGHT) >> 0);
    int left = Robot::Controller.getAnalog(okapi::ControllerAnalog::leftY);
    int right = Robot::Controller.getAnalog(okapi::ControllerAnalog::rightY);

    Robot::LeftDrive.move_voltage(left * 12000);
    Robot::RightDrive.move_voltage(right * 12000);

    pros::delay(20);
  }
}
