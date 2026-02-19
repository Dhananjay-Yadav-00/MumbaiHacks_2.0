# 🚨 HealthHIVE: AI Emergency Load Balancer for Urban Hospital Networks

An **intelligent agent** designed to optimize patient routing during **mass casualty incidents** in a city like **Mumbai**. This AI system predicts hospital strain and dynamically generates optimized dispatch plans — ensuring patients reach the *fastest available care*, not just the *closest hospital*.

Developed for the **MumbaiHacks Hackathon** 🧠💡


---

## 🌆 The Problem: Urban Overload During Emergencies

During a large-scale emergency, the default approach of sending all patients to the nearest hospital creates a **critical bottleneck**:

- The closest facility becomes **overwhelmed**, leading to long wait times.  
- Nearby hospitals remain **underutilized**.  
- The result: delayed critical care and **avoidable fatalities**.

Urban healthcare networks lack real-time, city-wide coordination — that’s where our **AI Emergency Load Balancer** comes in.


---

## 🤖 Our Solution: An Agentic AI Coordinator

The system functions as an **autonomous emergency coordinator** following a **Sense–Think–Act** cycle:

### 🧠 SENSE  
Monitors real-time data from hospitals, including:
- Bed occupancy  
- Staff availability  
- Specialty care units (e.g., trauma, burn, cardiac)

### 🤔 THINK  
Predicts and plans using AI:
- **XGBoost model** forecasts future ER wait times.  
- An **optimization algorithm** computes a “Time-to-Treatment” score — balancing travel time with predicted waiting time.

### 🚑 ACT  
Executes dynamic routing and load balancing:
- Suggests ambulance dispatch routes.  
- Notifies hospitals in advance.  
- Allocates resources to prevent system bottlenecks before they form.


---

## 🛠️ Tech Stack

### **Backend**
- **Framework:** Python (Flask)  
- **Machine Learning:** Scikit-learn, Pandas, NumPy, XGBoost  
- **Core Logic:** Standard Python libraries (subprocess, json)

### **Frontend**
- **Framework:** React.js  
- **Build Tool:** Vite  
- **API Client:** Axios  
- **Styling:** CSS

---

## 🔗 Project Link

🌐 **Live Demo:** https://mumbai-hacks-five.vercel.app

---

## **ScreenShots**
<img width="531" height="521" alt="Screenshot 2025-10-19 222645" src="https://github.com/user-attachments/assets/879b6ea7-60e4-4b5b-9246-999836bcf304" />
<img width="1919" height="1007" alt="Screenshot 2025-10-19 220950" src="https://github.com/user-attachments/assets/cb9899fe-10c5-4712-aee0-edc0562ecad6" />
<img width="1914" height="997" alt="Screenshot 2025-10-19 221049" src="https://github.com/user-attachments/assets/3e372aac-f53e-4af4-ad15-46554b51d26d" />
<img width="1919" height="1003" alt="Screenshot 2025-10-19 221131" src="https://github.com/user-attachments/assets/5077ee85-3ea7-4f8c-9e1a-23f67a7449ee" />
<img width="1907" height="976" alt="image" src="https://github.com/user-attachments/assets/32ef97ba-0a77-47c0-a108-7ba6cb636c15" />
<img width="1909" height="1002" alt="image" src="https://github.com/user-attachments/assets/1979e310-d947-4c0b-abfc-c8f62b8efe96" />

---
## 👥 Team & Acknowledgments

Developed by the **Data Dabbawalas Team-Karan Tulsani,Ved Dange,Dhananjay Yadav,Nimish Tilwani** 
Special thanks to the hackathon organizers and mentors for guidance and support.

---

> ⚙️ *AI that saves lives — optimizing emergency response, one decision at a time.*
