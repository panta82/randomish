(ns ^:figwheel-no-load randomish.dev
  (:require
    [randomish.core :as core]
    [devtools.core :as devtools]))


(enable-console-print!)

(devtools/install!)

(core/init!)
