(ns randomish.core
  (:require
    [reagent.core :as r]
    [chance :refer [Chance]]))

;; -------------------------
;; Global

(def string-pool "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ")

(defn init-chance [] (new Chance (.now js/Date)))

(def global-state
  (r/atom
    {
     :chance (init-chance)
     }))

;; -------------------------
;; Actions

(defn generate-strings [chance length count]
  (vec
    (repeatedly count
      #(.string chance (js-obj "pool" string-pool "length" length)))))

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

(defn String [value on-copy]
  [:div.String
   [:div.String-value
    {:onClick on-copy} value]])

(defn Strings [chance on-copy]
  (let
    [state (r/atom {:values (generate-strings chance 25 25)})
     copy (fn [index]
            (println "Copy " index))]
    (fn [_]
      [Section
       "Strings"
       (for [[index value] (map-indexed vector (:values @state))]
         ^{:key value} [String value #(copy index)])
       ])))

(defn RootPage []
  [:div.Randomish
   [Header]
   [:div.Randomish-sections
    [Strings (:chance @global-state)]]])

;; -------------------------
;; App level

(defn mount-root []
  (r/render [RootPage] (.getElementById js/document "app")))

(defn init! []
  (mount-root))
