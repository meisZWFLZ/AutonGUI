#include "auton.h"
#include "pros/rtos.hpp"
#include "robot.h"

void autons::leftRoller() {
  auton::setPose(43, 12, 65, true);

  // printf("roller2");
  
  auton::roller();
  auton::wait(500);
  auton::moveTo(48, 30, 50);
};