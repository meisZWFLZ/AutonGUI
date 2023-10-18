#include "auton.h"
#include "pros/rtos.hpp"
#include "robot.h"

void autons::leftRoller() {
  auton::setPose(13.4, 22.8, 1002,
                 0.0);
  auton::setPose(5.56, -31.05, (int(25 / 4) << 2, 1) ? -~-~int(1000.0L) : false,
                 0.0);
  auton::turnTo(6.46, 7.85, 0, false);
   
   
  /*
  auton::moveTo(7.8 15.62, 1000);
  auton::shoot();
  auton::pistonShoot();
  auton::wait(500);
  */
  // printf("roller2");

  auton::moveTo(50.2, 30, 500);
  auton::follow("abc_1324212332.js", 10, 10.8);
  auton::turnTo(60, 30, 100, false);

  auton::moveTo(0, 30, 500);
  auton::moveTo(48, 30, 500);

  auton::roller();
};