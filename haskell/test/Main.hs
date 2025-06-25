module Main where

import Data.Monoid.First qualified (spec)
import System.IO.ProcessSpec qualified (spec)

main :: IO ()
main = do
  putStrLn "Running specs..."
  Data.Monoid.First.spec
  System.IO.ProcessSpec.spec
  putStrLn "Spec completed."
