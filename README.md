# Kru Check

Kru Check is an open-source educational technology project designed to reduce repetitive administrative work for teachers and schools.

The project is developed from real classroom and school workflow needs, with a focus on practical tools that teachers can use without requiring expensive commercial software or dedicated IT teams.

## Current focus

Kru Check currently focuses on an offline-capable exam checking workflow, including:

- Browser-based OMR (Optical Mark Recognition)
- Client-side image processing
- Offline-first Progressive Web App (PWA)
- Student and classroom data management
- Exam answer keys and automatic scoring
- Review workflow for uncertain answers
- Local data storage using IndexedDB
- Synchronization architecture for cloud services
- Automated tests for OMR and scoring workflows

OMR processing is designed to run locally in the browser so that exam sheets can be processed even when an internet connection is unavailable.

## Why this project exists

Teachers often spend significant time on repetitive tasks such as checking exams, recording attendance, managing student data, preparing reports, and maintaining school records.

Kru Check aims to turn these real-world problems into reusable open-source tools, allowing teachers to spend more time on teaching and supporting students.

## Roadmap

The long-term goal is to develop Kru Check into a broader collection of open-source tools for education, including:

- Student attendance systems
- Teaching and learning materials
- Classroom management tools
- Personnel attendance and sign-in systems
- School reporting tools and dashboards
- Google Sheets and Google Drive integration
- Additional offline-capable tools for teachers

These features will be developed incrementally based on real classroom and school requirements.

## Technology

The project currently uses technologies including:

- JavaScript
- Progressive Web App (PWA)
- OpenCV.js / WebAssembly
- IndexedDB
- Service Workers
- Browser-based image processing
- Automated JavaScript tests

The architecture is designed so that computational tasks such as OMR recognition can run on the user's device, while cloud services can be used for data synchronization when connectivity is available.

## Contributing

Contributions, bug reports, suggestions, and discussions are welcome.

The project is still under active development, and documentation and contribution guidelines will continue to improve as the project grows.

## License

Kru Check is released under the MIT License. See `LICENSE` for details.
