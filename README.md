Stunning
=======

A distributed neural network using browsers via webRTC and that connect to eachother using STUN.

Only works in Chrome, pull requests to make it work in Firefox are welcome. The webRTC API is only available on Chrome and Firefox, so we will be limited to those browsers for now.

Install
----

npm install

Run
----
 * node app
 * Navigate to: http://localhost:3000/master
 * Open 6 client tabs at: http://localhost:3000/
 * Go to the master page, make sure that A0, A1, B0, B1, B2 and C0 are filled.
 * A simple XOR network is currently loaded.
 * Click 'Stream' and fill in 0 and 1, or 0 and 0, or 1 and 0 or 1 and 1.
 * Profit.


Todo
----

 * Backpropagation
 * Fix Firefox
 * Different types of activation functions
 * Deal with failures
 * Serialize and deserialize weights and configurations
 * Hook up the master page to the in and outputs using webRTC instead of using socket.io
 * Use a throttle mechanism (like TCP, so we can avoid overloading the network)
