import Data.Monoid.First

main :: IO ()
main = print (First (Just 15) <> First (Just 18))
