node --harmony app

FILE="cycle.forced"
if [ -f $FILE ]; then
   echo "$FILE exists."
   ./cycle.sh
   rm $FILE
fi

./start_and_watch_for_cycle.sh
