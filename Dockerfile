FROM alpine:3.18.2

# Volume for output
VOLUME /output

# Install dependencies
RUN apk add --no-cache nodejs yarn zsh npm

# Copy script and source
COPY . /usr/src/apn-competency-helper
COPY build-assets/run.sh /usr/src/run.sh
RUN chmod +x /usr/src/run.sh

# Build
WORKDIR /usr/src/apn-competency-helper
RUN yarn install
RUN npm run-script build

# Run
CMD ["/usr/src/run.sh"]
