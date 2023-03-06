# 1. Build the image:
## docker build -t electron-node-red-sample:dev .
# 2. Run the container:
## docker run --name electron_sample -it electron-node-red-sample:dev sh
# 3. Execute the following command from a new terminal window to copy the binary folder from the docker container:
## docker cp electron_sample:/project/electron-node-red/dist/win-unpacked .\
# 4. Start the .exe file in the copied folder
