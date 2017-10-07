#include <TinyWireS.h>
#include <math.h>

#ifndef TWI_RX_BUFFER_SIZE
#define TWI_RX_BUFFER_SIZE ( 16 )
#endif

#define I2C_SLAVE_ADDRESS 0x13

#define SWITCH 3
#define LED 4

int brightness = 0;    // how bright the LED is
int fadeAmount = 3;    // how many points to fade the LED by
unsigned long lastFadeUpdate = 0;

float wheelRadius = 0.33995;        // 700cc x 28mm
int revolutionTimeout = 1500;
float maxSpeed = 60;

float speed;
volatile byte rotation;
float timetaken, rpm, dtime;
unsigned long pevtime;
uint8_t speedAsByte;

void requestEvent() {
  TinyWireS.send(speedAsByte);
}

void setup() {
  TinyWireS.begin(I2C_SLAVE_ADDRESS);
  TinyWireS.onRequest(requestEvent);

  // initialize the LED pin as an output.
  pinMode(LED, OUTPUT);
  // initialize the SWITCH pin as an input.
  pinMode(SWITCH, INPUT);
  // ...with a pullup
  digitalWrite(SWITCH, HIGH);

  speed = 0;
  rotation = 0;
  rpm = 0;
  pevtime = 0;
}


long lastDebounceTime = 0;  // the last time the output pin was toggled
long debounceDelay = 15;    // the debounce time; increase if the output flickers
int state = LOW;
bool ping() {
  //filter out any noise by setting a time buffer
  if ( (millis() - lastDebounceTime) > debounceDelay) {
    bool newState = !digitalRead(SWITCH);
    bool ping = (state != newState && newState == HIGH);
    state = newState;
    if (ping) lastDebounceTime = millis();
    return ping;
  }

  return false;
}

void loop() {
  unsigned long currentMillis = millis();

  if (ping()) {
    brightness = 255;

    rotation++;
    dtime = currentMillis;
    if (rotation >= 2)
    {
      timetaken = currentMillis - pevtime; //time in millisec
      rpm = (1000 / timetaken) * 60;
      pevtime = currentMillis;
      rotation = 0;
    }

  }

  // drop to zero if no revolutions were detected after a while
  if (currentMillis - dtime > revolutionTimeout)  {
    // reset
    rpm = 0;
    speed = 0;
    speedAsByte = 0;
    dtime = currentMillis;
  } else {
    // calc speed
    speed = wheelRadius * rpm * 0.37699;
    float lSpeed = speed > maxSpeed ? maxSpeed : speed;
    speedAsByte = (((float(100) / maxSpeed) * lSpeed) / 100) * 255;
  }

  if(currentMillis - lastFadeUpdate > 10) {

    if (brightness > 0) {
      // reduce pulse
      brightness = brightness - fadeAmount;
    }
  
    analogWrite(LED, brightness);
    lastFadeUpdate = currentMillis;
  }

  //tws_delay(1);

  TinyWireS_stop_check();
}

