(defproject randomish "0.1.0-SNAPSHOT"
  :description "Web page to generate random passwords and other randomish things"
  :url "https://rand.pantas.net/"
  :license {:name "MIT"}

  :dependencies [[org.clojure/clojure "1.10.0"]
                 [org.clojure/clojurescript "1.10.516"]
                 [reagent "0.8.1"]
                 [alandipert/storage-atom "1.2.4"]]

  :plugins [[lein-cljsbuild "1.1.7"]
            [lein-figwheel "0.5.18"]]

  :clean-targets ^{:protect false}
[:target-path
 [:cljsbuild :builds :app :compiler :output-dir]
 [:cljsbuild :builds :app :compiler :output-to]]

  :resource-paths ["public"]

  :figwheel {:http-server-root "."
             :nrepl-port 7002
             :nrepl-middleware [cider.piggieback/wrap-cljs-repl]
             :css-dirs ["public/css"]}

  :cljsbuild
  {:builds
   {:app
    {:source-paths ["src" "env/dev/cljs"]
     :compiler
     {:main "randomish.dev"
      :output-to "public/js/app.js"
      :output-dir "public/js/build/out"
      :asset-path "build/out"
      :source-map true
      :optimizations :none
      :pretty-print true
      :install-deps true
      :npm-deps {:chance "1.0.18"
                 :time-ago "0.2.1"}}
     :figwheel
     {:on-jsload "randomish.core/mount-root"
      :open-urls ["http://localhost:3449/index.html"]}}

    :release
    {:source-paths ["src" "env/prod/cljs"]
     :compiler
     {:output-to "public/js/app.js"
      :output-dir "public/js/build/release"
      :optimizations :simple
      :infer-externs true
      :pretty-print true
      :source-map "public/js/app.js.map"
      :install-deps true
      :npm-deps {:chance "1.0.18"
                 :time-ago "0.2.1"}}
     }}}

   :aliases {"package" ["do" "clean" ["cljsbuild" "once" "release"]]}

   :profiles {:dev {:source-paths ["src" "env/dev/clj"]
                    :dependencies [[binaryage/devtools "0.9.10"]
                                   [figwheel-sidecar "0.5.18"]
                                   [nrepl "0.6.0"]
                                   [cider/piggieback "0.3.10"]]}})
