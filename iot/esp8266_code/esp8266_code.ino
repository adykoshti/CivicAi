#include <FSTools.h>

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <DHT.h>

// ---------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------
const char* ssid = "11i";         // User's WiFi Name
const char* password = "123456789"; // User's WiFi Password

// IMPORTANT: Use your computer's local IP address. 
// User reported: 10.14.111.134
const char* serverUrl = "http://10.14.111.134:8001/iot-data"; 

// DHT Sensor Config
#define DHTPIN 2     // Pin where DHT11 is connected (GPIO2 on NodeMCU usually D4)
#define DHTTYPE DHT11 // DHT 11
DHT dht(DHTPIN, DHTTYPE);

// ---------------------------------------------------------
// SETUP
// ---------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  // Start DHT Sensor
  dht.begin();
  
  Serial.println("\nConnecting to WiFi...");
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi Connection Failed.");
  }
}

// ---------------------------------------------------------
// MAIN LOOP
// ---------------------------------------------------------
void loop() {
  // Check WiFi connection status
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client;
    HTTPClient http;

    Serial.print("Connecting to: ");
    Serial.println(serverUrl);

    // Initialize HTTP connection
    http.begin(client, serverUrl);
    http.addHeader("Content-Type", "text/csv");

    // -----------------------------------------------------
    // SENSOR DATA READINGS
    // -----------------------------------------------------
    
    // 1. Temperature & Humidity (Real DHT11)
    float temp = dht.readTemperature();
    float humidity = dht.readHumidity();

    // Check if any reads failed and exit early (to try again).
    if (isnan(temp) || isnan(humidity)) {
      Serial.println("Failed to read from DHT sensor!");
      temp = 0.0;
      humidity = 0.0;
    }

    // 2. Air Quality (MQ-135)
    // MQ-135 measures broad range of gases (NH3, NOx, Alcohol, Benzene, Smoke, CO2)
    // To get specific PPM for CO, NO2, etc., you need complex calibration curves.
    // Here we use the raw analog value to ESTIMATE relative levels.
    
    int mq135_raw = analogRead(A0); 
    
    // Estimation Logic (simplified for demonstration/hackathon purposes)
    // High raw value = High pollution
    
    float nh3 = map(mq135_raw, 0, 1024, 1, 50);

    String location = "Ahmedabad";
    String timestamp = String(millis());

    // -----------------------------------------------------
    // CONSTRUCT PAYLOAD
    // -----------------------------------------------------
    String payload = location + "," + 
                     String(temp) + "," + 
                     String(humidity) + "," + 
                     String(mq135_raw) + "," + 
                     timestamp + "," + 
                     String(nh3);

    Serial.println("Sending Payload: " + payload);

    // Send POST Request
    int httpResponseCode = http.POST(payload);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.print("HTTP Response code: ");
      Serial.println(httpResponseCode);
      Serial.println("Server Response: " + response);
    } else {
      Serial.print("Error code: ");
      Serial.println(httpResponseCode);
    }

    // Free resources
    http.end();
  } else {
    Serial.println("WiFi Disconnected");
  }

  // Send data every 30 seconds
  Serial.println("Waiting 30 seconds...");
  delay(30000); 
}
