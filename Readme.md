# Survey Platform 

## Microservices

### Auth Service



## Functional Requirements

### 1. User Management
- **1.1 User registration and authentication:**  
  Users can register and authenticate via the platform.
- **1.2 User roles:**  
  There are three user roles: Survey Conductor, Participant, and Administrator.
- **1.3 User profile management:**  
  Users can manage and update their profiles.

### 2. Survey Creation and Management
- **2.1 Create, edit, and delete surveys:**  
  Survey Conductors can create, modify, and delete surveys.
- **2.2 Import/export survey questions:**  
  Surveys support importing and exporting questions in CSV format.
- **2.3 Support various question types:**  
  Surveys can include multiple-choice questions (MCQ), multiple selection questions (MSQ), rating scales, open-ended text, image ranking, and coding questions.
- **2.4 Embed media:**  
  Surveys can embed images, videos, and audio files.
- **2.5 Implement branching logic:**  
  Questions can branch based on previous responses.
- **2.6 Video-dependent questions:**  
  Certain questions can be locked until specific video playback criteria are met.

### 3. Participant Recruitment
- **3.1 Self-recruitment mode:**  
  Survey Conductors can generate shareable survey links for participants to self-enroll.
- **3.2 Platform recruitment service:**  
  - **3.2.1 Define participant criteria:**  
    Survey Conductors can specify criteria for participant selection.
  - **3.2.2 Match surveys with registered participants:**  
    The platform can match surveys with participants based on defined criteria.

### 4. Survey Taking
- **4.1 Web and mobile interfaces:**  
  Surveys are accessible via both web and mobile platforms.
- **4.2 Pause and resume survey progress:**  
  Participants can pause and resume surveys at their convenience.
- **4.3 Real-time response saving:**  
  Responses are saved in real-time.
- **4.4 Offline survey taking:**  
  Surveys can be taken offline and will sync when the participant reconnects.

### 5. Data Collection and Storage
- **5.1 Collect and store individual responses:**  
  All participant responses are securely collected and stored.
- **5.2 Ensure response anonymity:**  
  Participant responses can remain anonymous.
- **5.3 Self-hosted or cloud-based storage:**  
  Options for storing data locally or using cloud storage.

### 6. Analytics and Reporting
- **6.1 Basic result reports:**  
  The platform provides basic reporting tools for survey results.
- **6.2 Tools to refine responses:**  
  Responses can be sorted and refined using various filters.
- **6.3 Export results:**  
  Results can be exported in CSV, PDF, and other formats.

### 7. Administration
- **7.1 Platform configuration and management:**  
  Administrators can manage the overall platform configuration.
- **7.2 User management:**  
  Administrators can create, modify, and delete user accounts.
- **7.3 Monitor system usage and performance:**  
  Tools are provided to monitor system performance and usage.

## Non-Functional Requirements

### 1. Performance
- **1.1 Support concurrent users:**  
  The platform supports a minimum of 10,000 simultaneous users.
- **1.2 Response time:**  
  95% of requests have a response time of less than 2 seconds.
- **1.3 Page load time:**  
  Complex surveys load in less than 3 seconds.

### 2. Scalability
- **2.1 Microservices architecture:**  
  The platform is designed to support microservices for scalability.

### 3. Security
- **3.1 End-to-end encryption:**  
  All data transmissions are encrypted.
- **3.2 Regular security audits:**  
  Regular security audits and penetration testing are conducted.
- **3.3 Multi-factor authentication (MFA):**  
  Optional MFA for added security.

### 4. Usability
- **4.1 Intuitive interface:**  
  The platform features a user-friendly interface for both Survey Conductors and Participants.
- **4.2 Mobile-responsive design:**  
  The platform is responsive and optimized for mobile devices.

### 5. Maintainability
- **5.1 Modular architecture:**  
  The platform is built with a modular architecture for easier updates and maintenance.
- **5.2 Comprehensive logging and monitoring:**  
  Full logging and monitoring capabilities are available.
- **5.3 Automated testing:**  
  Code is covered by automated testing with over 80% coverage.

### 6. Compatibility
- **6.1 Browser support:**  
  Supports the latest versions of Chrome, Firefox, Safari, and Edge.
- **6.2 Mobile app support:**  
  Supports iOS 13+ and Android 8+ mobile applications.

### 7. Localization
- **7.1 Multi-language support:**  
  The platform initially supports English with easy options to add more languages.
- **7.2 Localization of date, time, and number formats:**  
  Formats are localized according to the user's region.

### 8. Data Integrity
- **8.1 Data validation checks:**  
  Data validation checks are implemented to ensure data accuracy.

### 9. Compliance
- **9.1 Adherence to industry standards:**  
  The platform adheres to relevant survey and market research industry standards.
- **9.2 Ethical guidelines:**  
  Surveys are conducted in compliance with ethical guidelines for data usage and participant privacy.

### 10. Interoperability
- **10.1 RESTful APIs:**  
  The platform provides RESTful APIs for integration with third-party systems.
- **10.2 Standard data exchange formats:**  
  Supports data exchange in standard formats such as JSON and XML.

  
