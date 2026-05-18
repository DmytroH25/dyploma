FROM eclipse-temurin:21

WORKDIR /app

COPY . .

RUN chmod +x gradlew

RUN ./gradlew build

EXPOSE 8080

CMD ["java", "-jar", "build/libs/ecc-for-dyploma-0.0.1-SNAPSHOT.jar"]