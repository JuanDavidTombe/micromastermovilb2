<?php

namespace Illuminate\Routing {
    class Router {
        public function get($uri, $callback) {}
        public function post($uri, $callback) {}
        public function patch($uri, $callback) {}
        public function put($uri, $callback) {}
        public function delete($uri, $callback) {}
        public function apiResource($uri, $controller) {}
        public function middleware($middleware, $callback) {}
        public function group($options, $callback) {}
    }
}
