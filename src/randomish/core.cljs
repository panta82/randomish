(ns randomish.core
    (:require
      [reagent.core :as r]))

;; -------------------------
;; Views

(defn Header []
  [:div.Header
   [:img.Header-logo {:src "/dice.svg"}]
   [:div.Header-title "Randomish"]])

(defn Section [title & children]
  [:div.Section
   [:div.Section-title title]
   [:div.Section-content children]])

(defn Strings []
  [Section "Strings"
    [:h4 "TODO"]])

(defn RootPage []
  [:div.Randomish
    [Header]
    [:div.Randomish-sections
     [Strings]]])

;; -------------------------
;; Initialize app

(defn mount-root []
  (r/render [RootPage] (.getElementById js/document "app")))

(defn init! []
  (mount-root))
