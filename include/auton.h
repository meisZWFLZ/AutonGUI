#pragma once
#include "lemlib/pose.hpp"
namespace auton {
void setPose(double x, double y, double theta, bool radians = false);
// void setPose(lemlib::Pose pose, bool radians = false);
void turnTo(float x, float y, int timeout, bool reversed = false,
            float maxSpeed = 127, bool log = false);
void moveTo(float x, float y, int timeout, float maxSpeed = 200,
            bool log = false);
void follow(const char *filePath, int timeout, float lookahead,
            bool reverse = false, float maxSpeed = 127, bool log = false);
void intake();
void stopIntake();
void shoot();
void pistonShoot();
void roller();
void expand();
void wait(int milliseconds);
}; // namespace auton
namespace autons {
void leftRoller();
void rightRoller();
void awp();
void skills();

}; // namespace autons