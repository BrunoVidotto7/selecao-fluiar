# Build stage runs on the builder's own architecture: the jar is platform independent.
FROM --platform=$BUILDPLATFORM eclipse-temurin:25-jdk AS build
WORKDIR /build
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw -q dependency:go-offline
COPY src src
RUN ./mvnw -q package -DskipTests

FROM eclipse-temurin:25-jre
RUN useradd --system --uid 10001 app
WORKDIR /app
COPY --from=build /build/target/selecao-api-0.0.1-SNAPSHOT.jar app.jar
USER app
EXPOSE 8080
# Management port (health and metrics): keep it internal, never publish it.
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
